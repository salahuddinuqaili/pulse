use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use rusqlite::{params, Connection};
use tracing::{error, info, warn};

use crate::types::{GpuSnapshot, SessionAggregates, SessionMetadata};

const MAX_RECORDING_DURATION_MS: u64 = 60 * 60 * 1000; // 60 minutes
const FORMAT_VERSION: u32 = 1;

// ── SessionRecorder ──────────────────────────────────────────────

struct RecorderState {
    id: String,
    file_path: PathBuf,
    encoder: GzEncoder<fs::File>,
    start_ms: u64,
    interval_ms: u64,
    gpu_name: String,
    game_detected: Option<String>,
    snapshot_count: u32,
    // Running aggregates
    sum_temp: f64,
    max_temp: f32,
    sum_gpu_util: f64,
    max_gpu_util: f32,
    sum_vram_used: f64,
    max_vram_used: u32,
    sum_power: f64,
    max_power: f32,
    sum_fps: f64,
    max_fps: f32,
    fps_count: u32,
    sum_clock_graphics: f64,
    max_clock_graphics: u32,
}

pub struct SessionRecorder {
    sessions_dir: PathBuf,
    state: Mutex<Option<RecorderState>>,
}

impl SessionRecorder {
    pub fn new(sessions_dir: PathBuf) -> Self {
        if let Err(e) = fs::create_dir_all(&sessions_dir) {
            error!("Failed to create sessions directory: {e}");
        }
        Self {
            sessions_dir,
            state: Mutex::new(None),
        }
    }

    pub fn is_recording(&self) -> bool {
        self.state.lock().unwrap().is_some()
    }

    pub fn start(
        &self,
        interval_ms: u64,
        gpu_name: String,
        game_detected: Option<String>,
    ) -> Result<String, String> {
        let mut state = self.state.lock().unwrap();
        if state.is_some() {
            return Err("Already recording".to_string());
        }

        let id = uuid::Uuid::new_v4().to_string();
        let file_name = format!("session-{id}.pulse");
        let file_path = self.sessions_dir.join(&file_name);

        let file = fs::File::create(&file_path)
            .map_err(|e| format!("Failed to create session file: {e}"))?;
        let mut encoder = GzEncoder::new(file, Compression::fast());

        let now_ms = now_millis();

        // Write metadata header as first JSON line
        let header = serde_json::json!({
            "version": FORMAT_VERSION,
            "id": id,
            "start_ms": now_ms,
            "interval_ms": interval_ms,
            "gpu_name": gpu_name,
            "game_detected": game_detected,
        });
        let header_line = serde_json::to_string(&header)
            .map_err(|e| format!("Failed to serialize header: {e}"))?;
        encoder
            .write_all(header_line.as_bytes())
            .map_err(|e| format!("Failed to write header: {e}"))?;
        encoder
            .write_all(b"\n")
            .map_err(|e| format!("Failed to write newline: {e}"))?;

        info!("Started recording session {id}");

        *state = Some(RecorderState {
            id: id.clone(),
            file_path,
            encoder,
            start_ms: now_ms,
            interval_ms,
            gpu_name,
            game_detected,
            snapshot_count: 0,
            sum_temp: 0.0,
            max_temp: 0.0,
            sum_gpu_util: 0.0,
            max_gpu_util: 0.0,
            sum_vram_used: 0.0,
            max_vram_used: 0,
            sum_power: 0.0,
            max_power: 0.0,
            sum_fps: 0.0,
            max_fps: 0.0,
            fps_count: 0,
            sum_clock_graphics: 0.0,
            max_clock_graphics: 0,
        });

        Ok(id)
    }

    /// Write a snapshot to the active recording. Returns true if recording should auto-stop.
    pub fn write_snapshot(&self, snapshot: &GpuSnapshot) -> Result<bool, String> {
        let mut state = self.state.lock().unwrap();
        let recorder = match state.as_mut() {
            Some(r) => r,
            None => return Ok(false),
        };

        // Check max duration
        let elapsed = now_millis().saturating_sub(recorder.start_ms);
        if elapsed >= MAX_RECORDING_DURATION_MS {
            return Ok(true); // Signal auto-stop
        }

        // Serialize and write snapshot
        let line = serde_json::to_string(snapshot)
            .map_err(|e| format!("Failed to serialize snapshot: {e}"))?;
        recorder
            .encoder
            .write_all(line.as_bytes())
            .map_err(|e| format!("Failed to write snapshot: {e}"))?;
        recorder
            .encoder
            .write_all(b"\n")
            .map_err(|e| format!("Failed to write newline: {e}"))?;

        // Update running aggregates
        recorder.snapshot_count += 1;
        let n = recorder.snapshot_count;
        let temp = snapshot.temperature_c as f32;
        recorder.sum_temp += temp as f64;
        if temp > recorder.max_temp {
            recorder.max_temp = temp;
        }

        let util = snapshot.gpu_utilization as f32;
        recorder.sum_gpu_util += util as f64;
        if util > recorder.max_gpu_util {
            recorder.max_gpu_util = util;
        }

        let vram = snapshot.vram_used_mb;
        recorder.sum_vram_used += vram as f64;
        if vram > recorder.max_vram_used {
            recorder.max_vram_used = vram;
        }

        recorder.sum_power += snapshot.power_draw_w as f64;
        if snapshot.power_draw_w > recorder.max_power {
            recorder.max_power = snapshot.power_draw_w;
        }

        if let Some(fps) = snapshot.fps_current {
            recorder.sum_fps += fps as f64;
            recorder.fps_count += 1;
            if fps > recorder.max_fps {
                recorder.max_fps = fps;
            }
        }

        recorder.sum_clock_graphics += snapshot.clock_graphics_mhz as f64;
        if snapshot.clock_graphics_mhz > recorder.max_clock_graphics {
            recorder.max_clock_graphics = snapshot.clock_graphics_mhz;
        }

        // Flush periodically to avoid data loss
        if n % 30 == 0 {
            let _ = recorder.encoder.flush();
        }

        Ok(false)
    }

    /// Stop the active recording and return metadata with aggregates.
    pub fn stop(&self) -> Result<SessionMetadata, String> {
        let mut state = self.state.lock().unwrap();
        let recorder = state.take().ok_or("No active recording")?;

        // Finish the gzip stream
        recorder
            .encoder
            .finish()
            .map_err(|e| format!("Failed to finalize gzip: {e}"))?;

        let end_ms = now_millis();
        let n = recorder.snapshot_count;
        let file_name = recorder
            .file_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let aggregates = if n > 0 {
            let nf = n as f64;
            Some(SessionAggregates {
                avg_temp: (recorder.sum_temp / nf) as f32,
                max_temp: recorder.max_temp,
                avg_gpu_util: (recorder.sum_gpu_util / nf) as f32,
                max_gpu_util: recorder.max_gpu_util,
                avg_vram_used_mb: (recorder.sum_vram_used / nf) as f32,
                max_vram_used_mb: recorder.max_vram_used,
                avg_power_w: (recorder.sum_power / nf) as f32,
                max_power_w: recorder.max_power,
                avg_fps: if recorder.fps_count > 0 {
                    Some((recorder.sum_fps / recorder.fps_count as f64) as f32)
                } else {
                    None
                },
                max_fps: if recorder.fps_count > 0 {
                    Some(recorder.max_fps)
                } else {
                    None
                },
                avg_clock_graphics_mhz: (recorder.sum_clock_graphics / nf) as f32,
                max_clock_graphics_mhz: recorder.max_clock_graphics,
            })
        } else {
            None
        };

        let metadata = SessionMetadata {
            id: recorder.id.clone(),
            start_ms: recorder.start_ms,
            end_ms: Some(end_ms),
            interval_ms: recorder.interval_ms,
            gpu_name: recorder.gpu_name,
            game_detected: recorder.game_detected,
            snapshot_count: n,
            file_name,
            aggregates,
        };

        info!(
            "Stopped recording session {} ({n} snapshots)",
            recorder.id
        );

        Ok(metadata)
    }
}

// ── SessionIndex (SQLite) ────────────────────────────────────────

pub struct SessionIndex {
    conn: Mutex<Connection>,
    sessions_dir: PathBuf,
}

impl SessionIndex {
    pub fn new(sessions_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&sessions_dir)
            .map_err(|e| format!("Failed to create sessions dir: {e}"))?;

        let db_path = sessions_dir.join("sessions.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open sessions.db: {e}"))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                start_ms INTEGER NOT NULL,
                end_ms INTEGER,
                interval_ms INTEGER NOT NULL,
                gpu_name TEXT NOT NULL,
                game_detected TEXT,
                snapshot_count INTEGER NOT NULL DEFAULT 0,
                file_name TEXT NOT NULL,
                avg_temp REAL,
                max_temp REAL,
                avg_gpu_util REAL,
                max_gpu_util REAL,
                avg_vram_used_mb REAL,
                max_vram_used_mb INTEGER,
                avg_power_w REAL,
                max_power_w REAL,
                avg_fps REAL,
                max_fps REAL,
                avg_clock_graphics_mhz REAL,
                max_clock_graphics_mhz INTEGER
            );",
        )
        .map_err(|e| format!("Failed to create sessions table: {e}"))?;

        let index = Self {
            conn: Mutex::new(conn),
            sessions_dir,
        };

        if let Err(e) = index.reconcile() {
            warn!("Session reconciliation had errors: {e}");
        }

        Ok(index)
    }

    pub fn insert_session(&self, meta: &SessionMetadata) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let agg = meta.aggregates.as_ref();

        conn.execute(
            "INSERT OR REPLACE INTO sessions (
                id, start_ms, end_ms, interval_ms, gpu_name, game_detected,
                snapshot_count, file_name,
                avg_temp, max_temp, avg_gpu_util, max_gpu_util,
                avg_vram_used_mb, max_vram_used_mb,
                avg_power_w, max_power_w,
                avg_fps, max_fps,
                avg_clock_graphics_mhz, max_clock_graphics_mhz
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
            params![
                meta.id,
                meta.start_ms,
                meta.end_ms,
                meta.interval_ms,
                meta.gpu_name,
                meta.game_detected,
                meta.snapshot_count,
                meta.file_name,
                agg.map(|a| a.avg_temp),
                agg.map(|a| a.max_temp),
                agg.map(|a| a.avg_gpu_util),
                agg.map(|a| a.max_gpu_util),
                agg.map(|a| a.avg_vram_used_mb),
                agg.map(|a| a.max_vram_used_mb),
                agg.map(|a| a.avg_power_w),
                agg.map(|a| a.max_power_w),
                agg.and_then(|a| a.avg_fps),
                agg.and_then(|a| a.max_fps),
                agg.map(|a| a.avg_clock_graphics_mhz),
                agg.map(|a| a.max_clock_graphics_mhz),
            ],
        )
        .map_err(|e| format!("Failed to insert session: {e}"))?;

        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionMetadata>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM sessions ORDER BY start_ms DESC")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let rows = stmt
            .query_map([], |row| Ok(row_to_metadata(row)))
            .map_err(|e| format!("Failed to query sessions: {e}"))?;

        let mut sessions = Vec::new();
        for row in rows {
            match row {
                Ok(meta) => sessions.push(meta),
                Err(e) => warn!("Skipping corrupt session row: {e}"),
            }
        }
        Ok(sessions)
    }

    pub fn list_sessions_in_range(
        &self,
        start_ms: u64,
        end_ms: u64,
    ) -> Result<Vec<SessionMetadata>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM sessions WHERE start_ms >= ?1 AND start_ms <= ?2 ORDER BY start_ms DESC")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let rows = stmt
            .query_map(params![start_ms, end_ms], |row| Ok(row_to_metadata(row)))
            .map_err(|e| format!("Failed to query sessions: {e}"))?;

        let mut sessions = Vec::new();
        for row in rows {
            match row {
                Ok(meta) => sessions.push(meta),
                Err(e) => warn!("Skipping corrupt session row: {e}"),
            }
        }
        Ok(sessions)
    }

    pub fn delete_session(&self, session_id: &str) -> Result<(), String> {
        // Find the file name first
        let conn = self.conn.lock().unwrap();
        let file_name: Option<String> = conn
            .query_row(
                "SELECT file_name FROM sessions WHERE id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .ok();

        // Delete from SQLite
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])
            .map_err(|e| format!("Failed to delete session: {e}"))?;

        // Delete the .pulse file
        if let Some(fname) = file_name {
            let path = self.sessions_dir.join(fname);
            if path.exists()
                && let Err(e) = fs::remove_file(&path)
            {
                warn!("Failed to delete session file: {e}");
            }
        }

        Ok(())
    }

    /// Load full snapshot data from a .pulse file.
    pub fn load_session(&self, session_id: &str) -> Result<Vec<GpuSnapshot>, String> {
        let conn = self.conn.lock().unwrap();
        let file_name: String = conn
            .query_row(
                "SELECT file_name FROM sessions WHERE id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Session not found: {e}"))?;
        drop(conn);

        let path = self.sessions_dir.join(file_name);
        read_pulse_file_snapshots(&path)
    }

    /// Reconcile .pulse files with SQLite index on startup.
    fn reconcile(&self) -> Result<(), String> {
        let entries = fs::read_dir(&self.sessions_dir)
            .map_err(|e| format!("Failed to read sessions dir: {e}"))?;

        let conn = self.conn.lock().unwrap();
        let mut indexed_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

        // Collect all indexed session IDs
        {
            let mut stmt = conn
                .prepare("SELECT id FROM sessions")
                .map_err(|e| format!("Failed to query sessions: {e}"))?;
            let rows = stmt
                .query_map([], |row| row.get::<_, String>(0))
                .map_err(|e| format!("Query error: {e}"))?;
            for row in rows.flatten() {
                indexed_ids.insert(row);
            }
        }

        // Check each .pulse file
        let mut file_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("pulse") {
                continue;
            }

            match read_pulse_header(&path) {
                Ok(header) => {
                    let id = header.id.clone();
                    file_ids.insert(id.clone());

                    if !indexed_ids.contains(&id) {
                        // File exists but not in index — insert from header
                        warn!("Reconciling orphaned .pulse file: {}", path.display());
                        let file_name = path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        let meta = SessionMetadata {
                            id: header.id,
                            start_ms: header.start_ms,
                            end_ms: None,
                            interval_ms: header.interval_ms,
                            gpu_name: header.gpu_name,
                            game_detected: header.game_detected,
                            snapshot_count: 0,
                            file_name,
                            aggregates: None,
                        };
                        // Use a separate method call with the conn we already have
                        conn.execute(
                            "INSERT OR IGNORE INTO sessions (
                                id, start_ms, end_ms, interval_ms, gpu_name,
                                game_detected, snapshot_count, file_name
                            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            params![
                                meta.id,
                                meta.start_ms,
                                meta.end_ms,
                                meta.interval_ms,
                                meta.gpu_name,
                                meta.game_detected,
                                meta.snapshot_count,
                                meta.file_name,
                            ],
                        )
                        .map_err(|e| format!("Failed to reconcile session: {e}"))?;
                    }
                }
                Err(e) => {
                    warn!("Failed to read .pulse header {}: {e}", path.display());
                }
            }
        }

        // Remove orphaned index entries (SQLite row but no file)
        for id in &indexed_ids {
            if !file_ids.contains(id) {
                warn!("Removing orphaned index entry: {id}");
                conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])
                    .map_err(|e| format!("Failed to delete orphan: {e}"))?;
            }
        }

        Ok(())
    }
}

// ── Helpers ──────────────────────────────────────────────────────

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(serde::Deserialize)]
struct PulseHeader {
    #[allow(dead_code)]
    version: u32,
    id: String,
    start_ms: u64,
    interval_ms: u64,
    gpu_name: String,
    game_detected: Option<String>,
}

fn read_pulse_header(path: &Path) -> Result<PulseHeader, String> {
    let file = fs::File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;
    let decoder = GzDecoder::new(file);
    let reader = BufReader::new(decoder);

    let first_line = reader
        .lines()
        .next()
        .ok_or("Empty .pulse file")?
        .map_err(|e| format!("Failed to read header line: {e}"))?;

    serde_json::from_str(&first_line).map_err(|e| format!("Invalid header JSON: {e}"))
}

fn read_pulse_file_snapshots(path: &Path) -> Result<Vec<GpuSnapshot>, String> {
    let file = fs::File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;
    let decoder = GzDecoder::new(file);
    let reader = BufReader::new(decoder);

    let mut snapshots = Vec::new();
    let mut first = true;

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Read error: {e}"))?;
        if first {
            first = false;
            continue; // Skip header line
        }
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<GpuSnapshot>(&line) {
            Ok(snap) => snapshots.push(snap),
            Err(e) => warn!("Skipping corrupt snapshot line: {e}"),
        }
    }

    Ok(snapshots)
}

fn row_to_metadata(row: &rusqlite::Row) -> SessionMetadata {
    let avg_temp: Option<f32> = row.get(8).unwrap_or(None);

    let aggregates = avg_temp.map(|_| SessionAggregates {
        avg_temp: row.get(8).unwrap_or(0.0),
        max_temp: row.get(9).unwrap_or(0.0),
        avg_gpu_util: row.get(10).unwrap_or(0.0),
        max_gpu_util: row.get(11).unwrap_or(0.0),
        avg_vram_used_mb: row.get(12).unwrap_or(0.0),
        max_vram_used_mb: row.get(13).unwrap_or(0),
        avg_power_w: row.get(14).unwrap_or(0.0),
        max_power_w: row.get(15).unwrap_or(0.0),
        avg_fps: row.get(16).unwrap_or(None),
        max_fps: row.get(17).unwrap_or(None),
        avg_clock_graphics_mhz: row.get(18).unwrap_or(0.0),
        max_clock_graphics_mhz: row.get(19).unwrap_or(0),
    });

    SessionMetadata {
        id: row.get(0).unwrap_or_default(),
        start_ms: row.get::<_, i64>(1).unwrap_or(0) as u64,
        end_ms: row.get::<_, Option<i64>>(2).unwrap_or(None).map(|v| v as u64),
        interval_ms: row.get::<_, i64>(3).unwrap_or(1000) as u64,
        gpu_name: row.get(4).unwrap_or_default(),
        game_detected: row.get(5).unwrap_or(None),
        snapshot_count: row.get::<_, i32>(6).unwrap_or(0) as u32,
        file_name: row.get(7).unwrap_or_default(),
        aggregates,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn test_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pulse-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_recorder_start_stop() {
        let dir = test_dir();
        let recorder = SessionRecorder::new(dir.clone());

        let id = recorder
            .start(1000, "RTX 5070".to_string(), None)
            .unwrap();
        assert!(!id.is_empty());
        assert!(recorder.is_recording());

        let meta = recorder.stop().unwrap();
        assert_eq!(meta.id, id);
        assert_eq!(meta.snapshot_count, 0);
        assert!(!recorder.is_recording());

        // Verify file exists
        let file_path = dir.join(&meta.file_name);
        assert!(file_path.exists());

        // Cleanup
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_recorder_write_snapshot() {
        let dir = test_dir();
        let recorder = SessionRecorder::new(dir.clone());

        let _id = recorder
            .start(1000, "RTX 5070".to_string(), Some("TestGame".to_string()))
            .unwrap();

        let snapshot = GpuSnapshot {
            temperature_c: 65,
            gpu_utilization: 80,
            vram_used_mb: 4096,
            power_draw_w: 200.0,
            clock_graphics_mhz: 2100,
            ..Default::default()
        };

        let should_stop = recorder.write_snapshot(&snapshot).unwrap();
        assert!(!should_stop);

        let meta = recorder.stop().unwrap();
        assert_eq!(meta.snapshot_count, 1);
        assert!(meta.aggregates.is_some());

        let agg = meta.aggregates.unwrap();
        assert_eq!(agg.max_temp, 65.0);
        assert_eq!(agg.max_vram_used_mb, 4096);

        // Verify file is readable
        let file_path = dir.join(&meta.file_name);
        let snapshots = read_pulse_file_snapshots(&file_path).unwrap();
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].temperature_c, 65);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_session_index_crud() {
        let dir = test_dir();

        // Create a valid .pulse file first so reconciliation doesn't remove it
        let recorder = SessionRecorder::new(dir.clone());
        let id = recorder
            .start(1000, "RTX 5070".to_string(), None)
            .unwrap();
        let meta = recorder.stop().unwrap();

        let index = SessionIndex::new(dir.clone()).unwrap();
        index.insert_session(&meta).unwrap();

        let sessions = index.list_sessions().unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, id);

        index.delete_session(&id).unwrap();
        let sessions = index.list_sessions().unwrap();
        assert_eq!(sessions.len(), 0);

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_double_start_fails() {
        let dir = test_dir();
        let recorder = SessionRecorder::new(dir.clone());

        recorder
            .start(1000, "RTX 5070".to_string(), None)
            .unwrap();
        let result = recorder.start(1000, "RTX 5070".to_string(), None);
        assert!(result.is_err());

        recorder.stop().unwrap();
        fs::remove_dir_all(&dir).ok();
    }
}
