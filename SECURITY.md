# Security

Pulse is a local desktop monitoring tool. This document describes the threat model, current findings, and how to report new issues.

## Reporting a Vulnerability

**Do not open public GitHub issues for security bugs.** Instead, use [GitHub's private security advisory flow](https://github.com/salahuddinuqaili/pulse/security/advisories/new) to report privately.

Include:
- The Pulse version (`Settings → About` or the installer filename)
- A clear description of the issue and the impact
- Steps to reproduce, ideally with a minimal proof of concept
- Whether you'd like to be credited in the fix release notes

We aim to acknowledge reports within a few days. Critical issues are patched in a point release; non-critical issues land in the next planned phase.

## Threat Model

### What Pulse is

Pulse is a desktop application that runs on a single trusted user's own Windows machine. It reads NVIDIA GPU state via NVML, monitors processes via `sysinfo`, and presents the data in a Tauri 2 WebView. From v0.3 it also exposes a localhost-only HTTP server (the MCP server) so AI tools running on the same machine can query GPU state.

### What Pulse is not

- A multi-user server
- An internet-facing service
- A safety-critical control system
- A sandbox for untrusted code (today; the future plugin API in v1.0 will need to address this)

### Trust boundaries

| Boundary | Inside (trusted) | Outside (untrusted) |
|---|---|---|
| Local machine | The Pulse user's session | Other users on the same machine, malware running as a different user |
| Pulse process | The Rust backend, the Tauri WebView | Anything reaching Pulse over the MCP server, future plugins |
| Settings storage | `%APPDATA%/Pulse/` files | Backup tools, file sync, accidental sharing of these files |
| Hardware writes (v1.0+) | Pulse running with admin elevation | Pulse running as a normal user |

### In scope

- **Local privilege escalation** — Pulse must not become a vector for non-admin code to gain admin
- **Information disclosure** — process names, command lines, and GPU state must not leak via the MCP server, session recordings, or notifications without explicit user consent
- **Credential leakage** — secrets stored by Pulse (Stream Deck API keys, OBS WebSocket passwords) must not be readable by other apps or backed up in plaintext
- **DNS rebinding / cross-origin attacks** — the localhost MCP server must reject requests originating from web pages
- **Tampering with hardware writes** — the v1.0 auto-revert mechanism must not be exploitable to write attacker-chosen values to the GPU
- **Plugin sandboxing** — when the v1.0 plugin API ships, plugins must not have hardware-write access without user approval

### Out of scope (known limitations)

- **Multi-user host isolation** — Pulse trusts everything in the user's session. On a shared Windows host, all logged-in users can interact with Pulse's MCP server if it's running. Document with `Settings → MCP` warning, do not architect against.
- **Physical access attacks** — an attacker with physical access to an unlocked machine can do anything Pulse can
- **Compromised driver / NVML implementation** — Pulse trusts NVML to return accurate data
- **Side-channel attacks on GPU state** — Pulse exposes GPU telemetry by design; users running Pulse accept that this data is observable to anything they grant access to
- **AMD / Intel GPUs** — not supported; no security claims made
- **Code-signed installer integrity** — Pulse installers are not yet code-signed (Authenticode). Users will see SmartScreen warnings on install. Planned for v0.5+.

## Known Findings

### Fixed

_None yet — Pulse is at v0.3._

### Planned (Phase 0.4 — "Harden Everything")

| ID | Finding | Severity | Status |
|---|---|---|---|
| F-01 | Process command lines are collected by default and exposed via MCP `gpu://status` and `gpu://vram/processes`, plus persisted in session recordings. Command lines routinely contain credentials (`psql --password=`, `python train.py --hf_token=`). Sharing a session export or hitting the MCP server from a malicious page leaks them. | High | Phase 0.4 D1 |
| F-02 | Stream Deck API key and OBS WebSocket password are stored as plaintext fields in `%APPDATA%/Pulse/settings.json`. Backup tools (OneDrive, Dropbox, Time Machine) sync this file. Accidentally sharing the file leaks secrets. | High | Phase 0.4 D2 |
| F-03 | The MCP server (Phase 0.3) does not validate the `Host` header. A malicious website can use DNS rebinding to instruct the user's browser to query `http://127.0.0.1:9426` and exfiltrate full GPU state including the process list. Standard same-origin policy does not protect because the response is JSON. | High | Phase 0.4 D3 |
| F-04 | Phase 1.0 will add hardware writes (fan curves, clocks, power) via NVML. Most NVML write APIs require Windows admin privileges. Pulse currently has no privilege model. Without a decision, Phase 1.0 implementation will hit a wall mid-deliverable and either ship as "always run as admin" (which elevates the entire MCP server and WebView) or block on a redesign. | High | Phase 0.4 D4 |
| F-05 | Tauri capabilities grant `core:event:allow-listen` and `core:event:allow-emit` globally. The frontend can spoof any backend event. With Phase 1.0 hardware writes, this becomes "frontend can spoof a hardware-write request". | Medium | Phase 0.4 D3 |
| F-06 | The Phase 1.0 auto-revert mechanism will persist "previous safe state" to `%APPDATA%/Pulse/restore.json`. If anything corrupts that file (bug, malware, manual edit), Pulse will write garbage values to NVML on next launch under the guise of "reverting". | Medium | Phase 0.4 D5 |

### Fixed in v0.4

| ID | Finding | Status |
|---|---|---|
| F-14 | PresentMon (Intel/GameTechDev binary used for FPS tracking) was bundled in the installer with no integrity verification. A repo compromise or supply-chain attack on the Pulse repository could replace it with a malicious binary that runs every time a game is detected, with full user privileges. | **Fixed in v0.4 spec PR.** PresentMon is no longer bundled. Pulse downloads the pinned v2.4.1 release on user opt-in via Settings → FPS Tracking, verifies SHA-256 against a constant baked into the source, and refuses to install any binary whose hash doesn't match. Full rationale in `presentmon_download.rs` and `DECISIONS.md` 2026-04-08. |

### Lower priority (tracked, not yet scheduled)

| ID | Finding | Why deprioritized |
|---|---|---|
| F-07 | `csp: null` in `tauri.conf.json`. No Content Security Policy on the WebView. | Defense-in-depth only; the Tauri IPC layer is the actual XSS surface for a desktop app. Will revisit if a real XSS vector is found in process names or exec paths. |
| F-08 | MCP server is reachable by every user on a multi-user Windows host. | Pulse's audience is single-user gaming/AI workstations. Will revisit when there's a concrete multi-user request. Mitigation path: bind the listener with a Windows ACL restricted to the launching user's SID. |
| F-09 | Vite dev server has multiple known CVEs (arbitrary file read, path traversal). | Dev-only; not in the shipped binary. `npm audit fix` resolves; will be applied in Phase 0.4 D5. |
| F-10 | No `cargo-audit` in CI; no `npm audit` gate in CI. Supply-chain advisories go undetected. | No Rust deps currently flagged. Adding to CI as part of Phase 0.4 D5. |
| F-11 | Notification body text includes process names ("ollama is now running"). Visible to anyone watching the user's screen. | Privacy info leak with low real impact; addressing via opt-in toggle in a later phase. |
| F-12 | MCP rate limiter `HashMap` is not pruned. | Localhost = one IP = one entry. Cosmetic memory issue. Will fix when we touch that file again. |
| F-13 | `load_session(session_id)` reads `sessions_dir.join(file_name)` where `file_name` comes from SQLite. A SQLite tamper enables path traversal. | Requires file system access to exploit; if you can tamper SQLite, you already have file system access. Will harden when path-validation utilities are added. |

## Security Commitments

These are promises about future architecture, not statements about today's code.

- **Hardware-write privilege separation (commitment for v1.1)** — Phase 0.4 ships Option 1 of the privilege model (detect non-admin, restart-as-admin). This is a stepping stone, not the final answer. v1.1 will introduce a privilege-separated helper process (`pulse-tuner.exe`) that runs elevated and accepts only hardware-write commands over an authenticated local pipe, while the main Pulse process stays in user mode. The Option 1 → Option 2 commitment is logged in `DECISIONS.md` and is binding.

- **Code signing (commitment for v0.5+)** — Pulse installers are currently unsigned. Installing Pulse triggers SmartScreen warnings as a result. Authenticode signing is planned for v0.5 alongside the privilege-separated helper (which requires signing to avoid SmartScreen blocking the helper binary on launch).

- **No telemetry without explicit opt-in** — Pulse does not, and will not, send any data to remote servers without an explicit per-feature opt-in toggle. The future community benchmark database (Phase 1.0 D7) is opt-in only and ships with the toggle defaulted OFF.

- **No secrets in repo** — API keys, signing certs, and credentials are never committed to the Pulse repo. The `keyring`-backed secret storage in Phase 0.4 D2 is the canonical place for any secret a user gives to Pulse.

## Reference

- Threat model written: 2026-04-08
- Last reviewed: 2026-04-08
- Next review: When Phase 0.4 ships, when Phase 1.0 hardware writes ship, or when a finding is filed
