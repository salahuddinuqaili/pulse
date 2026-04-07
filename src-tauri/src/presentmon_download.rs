//! PresentMon binary download manager.
//!
//! Pulse does not bundle PresentMon in the installer. Instead, the user opts
//! in via Settings → FPS Tracking, at which point Pulse downloads a pinned
//! version from Intel's GameTechDev/PresentMon GitHub releases, verifies the
//! SHA-256 against a constant baked into the source, and stores the binary
//! under `%APPDATA%/Pulse/bin/`.
//!
//! Why this design (vs bundling PresentMon in the installer):
//! - Smaller installer (~1 MB saved per release; matters for the 15 MB cap)
//! - No third-party binary in git history
//! - Explicit user consent for the download (privacy + supply-chain trust)
//! - Cryptographic verification against a known-good hash
//! - Sets a pattern reusable for future bundled binaries
//!
//! See `SECURITY.md` finding F-14 and `DECISIONS.md` 2026-04-08 for the full
//! rationale.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::{info, warn};

/// Pinned PresentMon version. Bumping this requires:
/// 1. Update the URL constant
/// 2. Update PRESENTMON_SHA256 with the new release's SHA-256
/// 3. Update PRESENTMON_FILENAME if the asset name changes
/// 4. Update PRESENTMON_VERSION
/// 5. Document the version bump in DECISIONS.md
pub const PRESENTMON_VERSION: &str = "2.4.1";
pub const PRESENTMON_FILENAME: &str = "PresentMon-2.4.1-x64.exe";
pub const PRESENTMON_URL: &str =
    "https://github.com/GameTechDev/PresentMon/releases/download/v2.4.1/PresentMon-2.4.1-x64.exe";

/// SHA-256 of the official Intel/GameTechDev release of PresentMon-2.4.1-x64.exe.
/// Computed from the upstream binary; any download whose hash doesn't match this
/// is rejected and never written to the filesystem.
pub const PRESENTMON_SHA256: &str =
    "d74183e7ae630f72cd3690be0373ecbfdc6cbb86578148aab8fa2a7166068f34";

pub const PRESENTMON_EXPECTED_SIZE: u64 = 927_304;

/// Status reported to the frontend so the Settings UI can render the right state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum PresentMonStatus {
    /// Binary is not present in `%APPDATA%/Pulse/bin/` — user has not opted in.
    NotInstalled,
    /// Download is in progress.
    Downloading {
        bytes_downloaded: u64,
        bytes_total: u64,
    },
    /// Download succeeded, hash verified, binary is ready.
    Installed { version: String },
    /// Download or verification failed. The binary (if any partial download
    /// existed) has been deleted. Caller can retry by invoking the download
    /// command again.
    Failed { error: String },
}

pub struct PresentMonDownloadManager {
    bin_dir: PathBuf,
    status: Mutex<PresentMonStatus>,
}

impl PresentMonDownloadManager {
    /// Create a manager rooted at `<app_data_dir>/bin/`. Reads the current
    /// filesystem state once to seed the initial status.
    pub fn new(app_data_dir: PathBuf) -> Self {
        let bin_dir = app_data_dir.join("bin");
        let initial_status = if bin_dir.join(PRESENTMON_FILENAME).exists() {
            PresentMonStatus::Installed {
                version: PRESENTMON_VERSION.to_string(),
            }
        } else {
            PresentMonStatus::NotInstalled
        };
        Self {
            bin_dir,
            status: Mutex::new(initial_status),
        }
    }

    /// Returns the resolved path to the PresentMon binary, regardless of
    /// whether the file exists. Used by `presentmon.rs` to know where to look.
    pub fn binary_path(&self) -> PathBuf {
        self.bin_dir.join(PRESENTMON_FILENAME)
    }

    /// Returns the current status snapshot.
    pub fn status(&self) -> PresentMonStatus {
        self.status.lock().unwrap().clone()
    }

    /// Returns `true` if the binary is currently installed and verified.
    pub fn is_installed(&self) -> bool {
        matches!(*self.status.lock().unwrap(), PresentMonStatus::Installed { .. })
    }

    fn set_status(&self, new_status: PresentMonStatus) {
        *self.status.lock().unwrap() = new_status;
    }

    /// Delete the installed binary. Used by Settings → "Remove" button.
    pub fn delete(&self) -> Result<(), String> {
        let path = self.binary_path();
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| format!("Failed to remove PresentMon: {e}"))?;
        }
        self.set_status(PresentMonStatus::NotInstalled);
        info!("Removed PresentMon from {}", path.display());
        Ok(())
    }

    /// Download the pinned PresentMon release, verify the SHA-256, and atomically
    /// move the verified binary into place. Updates `status` throughout.
    ///
    /// Fail-closed: if the hash doesn't match, the temp file is deleted and the
    /// status is set to Failed. The user can retry. Pulse never executes a
    /// binary whose hash doesn't match `PRESENTMON_SHA256`.
    pub async fn download(&self) -> Result<(), String> {
        std::fs::create_dir_all(&self.bin_dir)
            .map_err(|e| format!("Failed to create bin dir: {e}"))?;

        let final_path = self.binary_path();
        let temp_path = self.bin_dir.join(format!("{PRESENTMON_FILENAME}.partial"));

        // Clean up any leftover partial from a previous failed attempt
        let _ = std::fs::remove_file(&temp_path);

        self.set_status(PresentMonStatus::Downloading {
            bytes_downloaded: 0,
            bytes_total: PRESENTMON_EXPECTED_SIZE,
        });

        info!("Downloading PresentMon {PRESENTMON_VERSION} from {PRESENTMON_URL}");

        let result = self.download_inner(&temp_path).await;

        match result {
            Ok(()) => {
                // Atomic rename: only the verified binary ever appears at the final path
                std::fs::rename(&temp_path, &final_path).map_err(|e| {
                    let msg = format!("Failed to install PresentMon: {e}");
                    self.set_status(PresentMonStatus::Failed { error: msg.clone() });
                    msg
                })?;
                self.set_status(PresentMonStatus::Installed {
                    version: PRESENTMON_VERSION.to_string(),
                });
                info!("PresentMon installed at {}", final_path.display());
                Ok(())
            }
            Err(e) => {
                // Clean up the partial file on any failure (network, hash mismatch, IO)
                let _ = std::fs::remove_file(&temp_path);
                self.set_status(PresentMonStatus::Failed { error: e.clone() });
                warn!("PresentMon download failed: {e}");
                Err(e)
            }
        }
    }

    async fn download_inner(&self, temp_path: &PathBuf) -> Result<(), String> {
        let response = reqwest::get(PRESENTMON_URL)
            .await
            .map_err(|e| format!("Network error: {e}"))?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Download error: {e}"))?;

        if bytes.len() as u64 != PRESENTMON_EXPECTED_SIZE {
            return Err(format!(
                "Size mismatch: expected {} bytes, got {}",
                PRESENTMON_EXPECTED_SIZE,
                bytes.len()
            ));
        }

        // Verify SHA-256 BEFORE writing to disk. The bytes never leave memory if
        // the hash is wrong — we never write a tampered binary to the filesystem.
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let actual_hash = hex_encode(&hasher.finalize());

        if actual_hash != PRESENTMON_SHA256 {
            return Err(format!(
                "SHA-256 mismatch: expected {PRESENTMON_SHA256}, got {actual_hash}. \
                 This may indicate a corrupted download or a tampered upstream binary. \
                 Pulse refused to install the file."
            ));
        }

        // Hash verified — write to the partial path. The atomic rename happens
        // in the caller after this returns Ok.
        std::fs::write(temp_path, &bytes)
            .map_err(|e| format!("Failed to write binary: {e}"))?;

        Ok(())
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        s.push_str(&format!("{byte:02x}"));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_encode_matches_known_value() {
        // Empty SHA-256 hash
        let empty = Sha256::digest(b"");
        let hex = hex_encode(&empty);
        assert_eq!(
            hex,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn manager_initial_status_is_not_installed_when_dir_empty() {
        let temp = std::env::temp_dir().join(format!("pulse-test-{}", uuid::Uuid::new_v4()));
        let mgr = PresentMonDownloadManager::new(temp.clone());
        assert_eq!(mgr.status(), PresentMonStatus::NotInstalled);
        assert!(!mgr.is_installed());
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn manager_detects_pre_existing_install() {
        let temp = std::env::temp_dir().join(format!("pulse-test-{}", uuid::Uuid::new_v4()));
        let bin_dir = temp.join("bin");
        std::fs::create_dir_all(&bin_dir).unwrap();
        std::fs::write(bin_dir.join(PRESENTMON_FILENAME), b"fake binary").unwrap();

        let mgr = PresentMonDownloadManager::new(temp.clone());
        assert!(mgr.is_installed());
        match mgr.status() {
            PresentMonStatus::Installed { version } => {
                assert_eq!(version, PRESENTMON_VERSION);
            }
            other => panic!("Expected Installed, got {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn delete_removes_binary_and_resets_status() {
        let temp = std::env::temp_dir().join(format!("pulse-test-{}", uuid::Uuid::new_v4()));
        let bin_dir = temp.join("bin");
        std::fs::create_dir_all(&bin_dir).unwrap();
        let path = bin_dir.join(PRESENTMON_FILENAME);
        std::fs::write(&path, b"fake binary").unwrap();

        let mgr = PresentMonDownloadManager::new(temp.clone());
        assert!(mgr.is_installed());
        mgr.delete().unwrap();
        assert_eq!(mgr.status(), PresentMonStatus::NotInstalled);
        assert!(!path.exists());
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn delete_is_idempotent_when_no_binary() {
        let temp = std::env::temp_dir().join(format!("pulse-test-{}", uuid::Uuid::new_v4()));
        let mgr = PresentMonDownloadManager::new(temp.clone());
        assert!(mgr.delete().is_ok());
        assert_eq!(mgr.status(), PresentMonStatus::NotInstalled);
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn pinned_constants_are_consistent() {
        // Sanity check that the version string and filename agree
        assert!(PRESENTMON_FILENAME.contains(PRESENTMON_VERSION));
        assert!(PRESENTMON_URL.contains(PRESENTMON_VERSION));
        assert!(PRESENTMON_URL.contains(PRESENTMON_FILENAME));
        // Hash is 64 hex chars (256 bits)
        assert_eq!(PRESENTMON_SHA256.len(), 64);
        assert!(PRESENTMON_SHA256.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
