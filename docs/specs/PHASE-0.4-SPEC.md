# PHASE-0.4 Implementation Spec — "Harden Everything"

**Status:** Ready for implementation
**Prerequisite:** Phase 0.3 shipped, manually verified on hardware
**Branch pattern:** `feat/phase-0.4-*` (one branch per deliverable, PR to main)
**Decisions logged in:** `DECISIONS.md`
**Threat model:** `SECURITY.md`

This phase exists because Phase 0.3 shipped meaningful new attack surface (the MCP server, plaintext secret storage, persisted process command lines) and Phase 1.0 will add hardware writes. Fix the foundation before adding more on top of it.

Each deliverable in this spec maps directly to one or more findings in `SECURITY.md`. The security review is the source; this spec is the implementation plan.

---

## Decisions Summary

| Decision | Choice | Rejected | Reason |
|---|---|---|---|
| Command-line collection model | Single global toggle, OFF by default | Per-feature toggles (MCP / sessions / classification) | Per-feature is harder to reason about and easier to misconfigure |
| Secret storage backend | `keyring` crate (Windows Credential Manager) | Encrypted file with passphrase, in-memory only | Keyring is the standard Windows pattern; passphrase prompts every launch is bad UX; in-memory loses settings on restart |
| MCP host validation strategy | Allowlist `127.0.0.1:{port}` and `localhost:{port}`, reject everything else | Origin header check (not always sent), CSRF tokens (overkill for read-only), Bearer token auth | Allowlist is the simplest fix that closes DNS rebinding |
| Hardware-write privilege model | **Option 1**: detect non-admin, restart-as-admin button. Migration commitment to **Option 2** (helper process) in v1.1 | Option 2 in 0.4 (no code signing yet, 1-2 weeks extra), Option 3 always-admin (terrible UX, elevates entire app) | See `DECISIONS.md` 2026-04-08 entry for full reasoning |
| Integrity primitive scope | New `IntegrityFile<T>` wrapper introduced in 0.4, reused by Phase 1.0's `restore.json` | Skip until Phase 1.0 needs it | Phase 1.0 will move faster if the primitive already exists and is tested |
| Key derivation for `IntegrityFile` HMAC | First 32 bytes of `SHA256(user_sid)` | Random key persisted to disk, hardcoded key | Tamper-resistant against accidental corruption and untargeted edits, which is the actual threat. A targeted local attacker can read the SID — that's accepted scope |

---

## Deliverable Order

| # | Deliverable | Branch | Risk | Findings addressed |
|---|---|---|---|---|
| D1 | Strip command-line collection | `feat/phase-0.4-strip-cmdlines` | Low | F-01 |
| D2 | OS keyring for secret storage | `feat/phase-0.4-keyring` | Medium (new dep, migration) | F-02 |
| D3 | MCP Host validation + capability scoping | `feat/phase-0.4-mcp-hardening` | Low | F-03, F-05 |
| D4 | Hardware-write privilege detection | `feat/phase-0.4-privilege-model` | Medium (Windows-specific) | F-04 |
| D5 | Integrity primitive + audit gates | `feat/phase-0.4-integrity-audit` | Low | F-06, F-09, F-10 |

---

## D1: Strip Command-Line Collection

### Approach

Stop collecting process command lines by default. Add a single global Settings toggle `collect_command_lines: bool` (default `false`). The flag controls collection at the source — when off, `process::get_gpu_processes` doesn't ask `sysinfo` for command lines, so the data never enters Pulse's memory. There is no per-feature override (no separate "include in MCP" or "include in sessions" toggles) — this is intentionally simple.

When the user flips the toggle on, a Settings warning explains: *"Command lines may contain credentials (API keys, passwords). Only enable this if you understand the privacy implications."* When they flip it off, existing in-memory snapshots are cleared on the next poll tick.

### Why a single toggle, not per-feature

Considered three approaches:
1. **Global off-by-default** (chosen) — easy to reason about, can't be misconfigured
2. **Per-feature toggles** — `mcp_include_cmdlines`, `session_include_cmdlines`, `classification_use_cmdlines`. More flexible but the matrix of states is hard for users to understand and easy to get wrong
3. **Always collect, redact at output** — collect everything but strip credentials via regex on output. Brittle (regex can't catch every credential format), and the unstripped data still sits in memory and could leak via logs/crash dumps

Chosen for simplicity: if you don't want it leaking, don't collect it. The classification chain still works without command lines — it falls back to executable name and path, which catches the common cases (Python AI scripts being the notable exception, see migration notes below).

### Migration impact

Process classification currently uses command-line keywords as the 4th step in the priority chain (`python with torch/cuda/transformers/diffusers` → `ai`). With command lines off by default, this rule degrades. The fallback chain still works (VRAM heuristic catches >500MB processes as games or AI), but Python AI scripts launched without a recognizable executable name will be misclassified more often.

Mitigation: extend the executable-name match list to cover more Python entrypoints (`python.exe`, `pythonw.exe` paired with VRAM > 1GB → likely AI). Document the trade-off in the toggle help text so users who care about classification accuracy can opt in.

### New files

None.

### Modified files

- **`src-tauri/src/settings.rs`** — add `collect_command_lines: bool` with `#[serde(default)]` (defaults to `false` so existing settings.json files load without command lines)
- **`src-tauri/src/process.rs`** — `get_gpu_processes(collect_cmdlines: bool)` parameter; when false, skip the `process.cmd()` call entirely. Snapshot the setting once per poll tick (don't read from `SettingsManager` mid-loop).
- **`src-tauri/src/poller.rs`** — read `collect_command_lines` from `settings_mgr` once per tick, pass into `get_gpu_processes`
- **`src-tauri/src/classify.rs`** — extend executable-name match list with Python entrypoints + VRAM heuristic for unknown Python processes
- **`src/routes/settings.tsx`** — new "Privacy" section above "External Integrations". Single toggle with the warning text.

### Security rationale

Closes **F-01**. Removes the credential leak from MCP responses (the snapshot serializes `command_line: null`) and from session recordings (same).

### Test plan

- [ ] Unit: `process::get_gpu_processes(false)` returns `ProcessInfo` instances with `command_line == None`
- [ ] Unit: `process::get_gpu_processes(true)` includes command lines when present
- [ ] Unit: extended classification still tags Python+VRAM as AI without command lines
- [ ] Manual: toggle defaults to OFF for fresh installs
- [ ] Manual: toggle defaults to OFF for users upgrading from 0.3 (existing settings.json doesn't have the field)
- [ ] Manual: MCP `gpu://status` response shows `command_line: null` when toggle is off
- [ ] Manual: session recording made while toggle is off contains no command lines
- [ ] Manual: toggling on then back off clears command lines from the next snapshot
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

---

## D2: OS Keyring for Secret Storage

### Approach

Move `stream_deck_api_key` and `obs_ws_password` out of `settings.json` and into Windows Credential Manager via the `keyring` crate. `settings.json` keeps presence flags (`stream_deck_present: bool`, `obs_ws_present: bool`) so the UI can show "Key is set" / "No key set" without ever loading the actual value into the frontend.

### Why `keyring` over alternatives

| Approach | Pros | Cons |
|---|---|---|
| **`keyring` crate (chosen)** | Uses Windows Credential Manager natively, no extra dependencies for the user, standard pattern | Adds a Rust dep; values are encrypted at rest by Windows DPAPI under the user's SID |
| Encrypted file with passphrase | No platform deps, portable | Bad UX (passphrase prompt every launch), brittle key derivation, easy to lock yourself out |
| In-memory only | Zero persistence, simplest | User has to re-enter their API key every launch — defeats the purpose of "save the key" |
| Tauri Stronghold plugin | Official Tauri secret storage | Heavyweight (full vault system), overkill for a couple of secrets, depends on a passphrase |

### New dependencies

```toml
keyring = "3"
```

### New files

**`src-tauri/src/secrets.rs`** — Thin wrapper over the `keyring` crate

```rust
const SERVICE: &str = "Pulse";

pub fn set(name: &str, value: &str) -> Result<(), String>;
pub fn get(name: &str) -> Result<Option<String>, String>;
pub fn delete(name: &str) -> Result<(), String>;
pub fn is_set(name: &str) -> bool;
```

Names used: `stream_deck_api_key`, `obs_ws_password`. Both stored under service `Pulse` in Windows Credential Manager. Visible to the user via Control Panel → User Accounts → Credential Manager → Windows Credentials.

### Modified files

- **`src-tauri/Cargo.toml`** — add `keyring = "3"`
- **`src-tauri/src/settings.rs`** — remove `stream_deck_api_key` and `obs_ws_password` fields. Add `stream_deck_present: bool` and `obs_ws_present: bool` (both `#[serde(default)]`). On `SettingsManager::new`, run a migration: if the deserialized JSON had the old plaintext fields, write them to the keyring and rewrite settings.json without them.
- **`src-tauri/src/commands.rs`** — new commands:
  - `set_stream_deck_key(key: String) -> Result<(), String>`
  - `clear_stream_deck_key() -> Result<(), String>`
  - `set_obs_password(password: String) -> Result<(), String>`
  - `clear_obs_password() -> Result<(), String>`
  - Each updates the corresponding `_present` flag in settings.json
- **`src/routes/settings.tsx`** — replace the plaintext password inputs with a status row + Set/Clear buttons. Pattern: *"API key configured ✓ [Clear]"* or *"No API key set [Set key]"* with a modal for entering the value (not bound to React state — passed directly to the Tauri command and discarded).

### Migration of existing 0.3 settings.json

This is the trickiest part because Phase 0.3 D5 already shipped plaintext storage. Migration steps on first 0.4 launch:

1. Deserialize settings.json with both old (`stream_deck_api_key: Option<String>`) and new (`stream_deck_present: bool`) fields tolerated (use a custom deserializer or a temp `RawSettings` struct)
2. If old field is `Some(key)`, call `secrets::set("stream_deck_api_key", &key)`
3. Set `stream_deck_present = true`, drop the old field
4. Re-serialize and write settings.json
5. Same for OBS password
6. Log: `INFO: Migrated 2 secrets from settings.json to OS keyring`

If the keyring write fails (rare — Credential Manager unavailable), keep the old plaintext value in place and log a warning. The user can retry by editing the key in the UI.

### Security rationale

Closes **F-02**. Plaintext secrets no longer touch disk. Backup tools, file sync, and accidental sharing of `settings.json` no longer leak credentials.

### Test plan

- [ ] Unit: `secrets::set` then `get` round-trips correctly (uses `keyring` test backend in CI)
- [ ] Unit: `secrets::delete` removes the entry; subsequent `get` returns `None`
- [ ] Unit: settings.json deserializer tolerates both old and new field shapes
- [ ] Manual: fresh install — Set key → verify entry exists in Windows Credential Manager → Clear key → verify entry is removed
- [ ] Manual: upgrade from 0.3 — settings.json with plaintext keys migrates on first launch, plaintext is removed from JSON, keys appear in Credential Manager
- [ ] Manual: Settings UI shows "configured" status without ever loading the value
- [ ] Manual: deleting Pulse and reinstalling does NOT delete the keyring entries (users keep their secrets across uninstall — fix later if undesired)
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

---

## D3: MCP Host Validation + Capability Scoping

### Approach

Two related fixes that defend the existing MCP server (and the broader Tauri IPC surface) without changing the wire protocol or user-visible behavior.

### Part A: MCP Host header validation

Add an axum middleware that runs before any route handler and rejects requests whose `Host` header isn't in the allowlist:

- `127.0.0.1:{port}` (the literal loopback address)
- `localhost:{port}` (the loopback hostname)
- Missing `Host` header → reject

Returns `403 Forbidden` with body `host not allowed` on rejection. The check runs before rate limiting and before JSON parsing.

#### Why allowlist over alternatives

| Approach | Why not chosen |
|---|---|
| **Origin header check** | Browsers don't always send `Origin` for non-CORS requests; CLI tools never send it. Would break legitimate clients. |
| **CSRF token** | Overkill for a read-only API; requires state management on the client side |
| **Bearer token auth** | Heavyweight; defeats the "no auth on localhost" simplicity that the spec promised |
| **Allowlist `Host` header** (chosen) | Simple, defeats DNS rebinding, doesn't break any legitimate caller |

### Part B: Tauri capability scoping

Replace the broad `core:event:allow-listen` and `core:event:allow-emit` permissions with per-event scopes. Define which events the frontend is allowed to listen for and emit. The frontend should be allowed to listen for backend-emitted events but never emit them.

Currently allowed:
```json
"core:event:allow-listen",
"core:event:allow-emit"
```

Replace with explicit per-event allowlist. Backend events the frontend listens for: `gpu-snapshot`, `recommendation-update` (Phase 0.3), `notification-fired` (Phase 0.3), `pulse://orphaned-writes` (Phase 1.0 future).

Frontend should not be allowed to emit any of these — they're backend-only. This closes the spoofing vector for Phase 1.0 hardware-write events.

### New files

None.

### Modified files

- **`src-tauri/src/mcp_handler.rs`** — add `host_validator` middleware function and apply it in `router()`
- **`src-tauri/capabilities/default.json`** — replace broad event permissions with the scoped allowlist (exact syntax depends on Tauri 2.10's capability schema; verify with `tauri info` before writing)
- **`src-tauri/src/lib.rs`** — no change expected, but verify event emission still works after capability changes

### Security rationale

Closes **F-03** (DNS rebinding) and **F-05** (event spoofing).

### Test plan

- [ ] Unit: `host_validator` allows `127.0.0.1:9426`
- [ ] Unit: `host_validator` allows `localhost:9426`
- [ ] Unit: `host_validator` blocks `attacker.com`
- [ ] Unit: `host_validator` blocks missing `Host` header
- [ ] Unit: `host_validator` blocks wrong port (`127.0.0.1:8080`)
- [ ] Manual: `curl http://127.0.0.1:9426/` succeeds
- [ ] Manual: `curl -H "Host: evil.com" http://127.0.0.1:9426/message -X POST -d '{}'` returns 403
- [ ] Manual: existing MCP clients (any tool you've already integrated with Pulse) still work without changes
- [ ] Manual: Tauri events still flow from backend to frontend after capability changes
- [ ] Manual: frontend cannot emit `gpu-snapshot` (verify in DevTools console)
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

---

## D4: Hardware-Write Privilege Detection

### Approach

**Option 1 from the privilege model discussion.** Pulse runs as a normal user. Read operations (everything in Phase 0.x) work without elevation. Hardware-write operations (Phase 1.0) require Pulse to be running with administrator privileges. When the user navigates to a Tuning route (Phase 1.0 placeholder for now), they see either:

- (a) The full tuning UI, if the current process is elevated
- (b) An "elevation required" card with a "Restart Pulse as administrator" button

When the user clicks "Restart as administrator", Pulse spawns a new instance via `ShellExecuteW` with the `runas` verb (which triggers the UAC prompt), then exits the current process. State preservation across the restart is **not** implemented in 0.4 — sessions, MCP connections, and overlay state will be lost on relaunch. A warning toast before restart explicitly notes this.

### Migration commitment to Option 2 in v1.1

This is a stepping stone, not the final answer. The textbook-correct architecture is a privilege-separated helper process (`pulse-tuner.exe`) running elevated, with the main Pulse process staying in user mode and communicating over an authenticated local pipe. That requires code signing infrastructure (Authenticode certs, ~$300/year, several hours of pipeline setup) which Pulse doesn't have today.

**Commitment:** v1.1 will migrate to Option 2. The migration is logged in `DECISIONS.md` as binding. Phase 0.4's Option 1 is designed to be replaced — no Option 1-specific assumptions should leak into the Phase 1.0 hardware-write code beyond "check `is_elevated()` before calling NVML write APIs". When Option 2 lands, that check is replaced by "send the write request to the helper", and nothing else changes.

### Why this is OK as a stepping stone

The biggest concern with Option 1 is that the entire Pulse process (including the MCP server) runs elevated during a tuning session. After Phase 0.4 D3 hardens the MCP server against DNS rebinding and capability spoofing, the residual risk is "an unknown future MCP CVE during the tuning window" — non-zero but acceptable for v1.0. The Settings UI will warn users who have MCP enabled that tuning sessions also elevate the MCP server, with a recommendation to disable MCP before tuning.

### New dependencies

`windows` crate for elevation detection. Pulse already pulls `windows` transitively via Tauri, so this is verifying the feature flags rather than adding a new top-level dep:

```toml
windows = { version = "0.61", features = ["Win32_Security", "Win32_UI_Shell", "Win32_System_Threading"] }
```

### New files

**`src-tauri/src/elevation.rs`** — Windows-specific elevation utilities

```rust
/// Returns true if the current process token has TokenElevation = TRUE.
pub fn is_elevated() -> bool;

/// Spawns a new Pulse instance via ShellExecuteW with the "runas" verb,
/// which triggers a UAC prompt. Returns Ok if the new process was launched
/// (the current process should then exit). The caller is responsible for
/// graceful shutdown (flushing sessions, closing MCP connections).
pub fn relaunch_elevated() -> Result<(), String>;
```

**`src/components/tuning/elevation-required.tsx`** — The "Restart Pulse as administrator" card. Used by all Phase 1.0 Tuning routes as the fallback when `is_elevated() == false`.

### Modified files

- **`src-tauri/Cargo.toml`** — add `windows` feature flags if not already present
- **`src-tauri/src/lib.rs`** — register elevation commands; cache `is_elevated()` result at startup as part of `AppState` (the value can't change during a process lifetime)
- **`src-tauri/src/state.rs`** — add `is_elevated: bool` to `AppState`
- **`src-tauri/src/commands.rs`** — new commands:
  - `is_elevated() -> bool` — returns the cached value
  - `relaunch_as_admin() -> Result<(), String>` — calls `elevation::relaunch_elevated`, then triggers app shutdown
- **`src/lib/types.ts`** — add elevation state to relevant types
- **`src/routes/settings.tsx`** — new "Permissions" section showing current elevation state with a "Restart as administrator" button (regardless of whether the user is on a Tuning route)
- **`src/components/shell/header.tsx`** — small "Admin" badge in the header when elevated, so the user always knows the current state

### Test plan

- [ ] Unit: `is_elevated()` returns `false` in normal CI test environment (CI runs unelevated)
- [ ] Unit: `relaunch_elevated` returns Ok when ShellExecuteW succeeds (mock the call in tests)
- [ ] Manual: launch Pulse normally → Settings shows "Running as standard user" → no admin badge in header
- [ ] Manual: click "Restart as administrator" → confirmation toast warns about state loss → click confirm → UAC prompt → Pulse relaunches → Settings shows "Running as administrator" → admin badge visible in header
- [ ] Manual: deny the UAC prompt → original Pulse process keeps running unelevated (does NOT exit if relaunch failed)
- [ ] Manual: cancel the confirmation toast → no restart happens
- [ ] Manual: when elevated, placeholder Tuning route renders (Phase 1.0 will replace the placeholder with real UI)
- [ ] Manual: when not elevated, placeholder Tuning route shows the elevation-required card
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

### Security rationale

Closes **F-04** by establishing a clear privilege model before Phase 1.0 needs it. Phase 1.0's hardware-write code becomes "check `is_elevated()` first, then call NVML" — a single line of defense that's easy to audit.

---

## D5: Integrity Primitive + Audit Gates

### Approach

Three smaller hygiene fixes bundled into one deliverable. None individually justify their own PR, but together they establish important foundations.

### Part A: `IntegrityFile<T>` primitive

A generic wrapper for tamper-resistant file persistence. Used by Phase 1.0's `restore.json` (the "previous safe state" file for hardware-write auto-revert) and any future file where corruption could cause real harm.

**Format:** A JSON object with two top-level fields:
```json
{
  "hmac": "base64(hmac-sha256(data_bytes, key))",
  "data": { ... }
}
```

**Key derivation:** First 32 bytes of `SHA256(user_sid)`. The user SID is read once at startup via the `windows` crate (`GetTokenInformation` with `TokenUser`).

**Why HMAC instead of a signature:** HMAC is symmetric (same key for write and verify) and we're protecting against accidental corruption and untargeted edits, not against a determined local attacker. A targeted attacker who can read process memory can extract the SID-derived key — that's accepted scope. Asymmetric signatures would require a private key that has to be stored somewhere, which just moves the problem.

**Why SID-derived instead of random key persisted to disk:** A random key persisted to disk has the same threat model as HMAC (anyone with file access can read it) but adds a key file to manage. SID derivation is stateless and bound to the user account.

**Behavior on read:**
- Parse the file as JSON
- If `hmac` field is missing → reject (tampered or corrupted)
- Compute HMAC of the serialized `data` field, compare with stored `hmac`
- If mismatch → reject, return error (caller decides whether to treat as fatal or warn)
- If match → deserialize `data` as `T` and return

### Part B: `cargo-audit` and `npm audit` in CI

Add two new CI steps to `.github/workflows/ci.yml`:

```yaml
- name: cargo audit
  working-directory: src-tauri
  run: |
    cargo install cargo-audit --locked
    cargo audit --deny warnings

- name: npm audit
  run: npm audit --audit-level=high
```

Both run on every push. Failures block the build.

Also: run `npm audit fix` to resolve the existing high-severity vite vulns (F-09) and commit the lockfile change as part of this PR.

### Part C: Capability lockdown finalization

D3 already scopes Tauri event capabilities. D5 audits the rest of the capabilities file (`capabilities/default.json`) for any over-broad permissions and tightens them. Specifically:

- `notification:default` is broad — replace with the specific permissions Pulse actually uses (`notification:allow-notify`, `notification:allow-is-permission-granted`, `notification:allow-request-permission`)
- `shell:allow-open` only needs to allow opening URLs and Pulse's own data dir, not arbitrary paths — apply scope restrictions if Tauri 2 supports them

### New dependencies

```toml
hmac = "0.12"
sha2 = "0.10"
base64 = "0.22"
```

(All small, well-maintained crypto crates from the RustCrypto project.)

### New files

**`src-tauri/src/integrity.rs`** — `IntegrityFile<T>` wrapper (read/write/verify) plus tests

### Modified files

- **`src-tauri/Cargo.toml`** — add `hmac`, `sha2`, `base64`
- **`src-tauri/src/lib.rs`** — read user SID at startup, store HMAC key in `AppState` (not the SID itself — derive once)
- **`src-tauri/src/state.rs`** — add `integrity_key: [u8; 32]` field
- **`src-tauri/capabilities/default.json`** — tighten notification and shell permissions
- **`.github/workflows/ci.yml`** — add cargo-audit and npm audit steps
- **`package-lock.json`** — `npm audit fix` output

### Security rationale

Closes **F-06** (restore.json tamper resistance — primitive ready before Phase 1.0 needs it), **F-09** (vite CVEs), **F-10** (no audit gates in CI). Tightens **F-05** further by reducing capability surface area beyond what D3 already does.

### Test plan

- [ ] Unit: `IntegrityFile::write` then `read` round-trips a value correctly
- [ ] Unit: `IntegrityFile::read` rejects a file with a tampered `data` field
- [ ] Unit: `IntegrityFile::read` rejects a file with a missing `hmac` field
- [ ] Unit: `IntegrityFile::read` rejects a file written with a different key
- [ ] Unit: HMAC key derivation from SID is deterministic
- [ ] Manual: `cargo audit` runs in CI and currently passes (no Rust advisories)
- [ ] Manual: `npm audit --audit-level=high` runs in CI and passes after `npm audit fix`
- [ ] Manual: tighter notification/shell capabilities don't break existing features
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds
- [ ] **CI green on the merged main commit** — Phase 0.4 explicitly requires CI as a tripwire because the prior CI failure (PresentMon resource glob) has presumably been fixed before this phase begins

---

## New Dependencies (cumulative across deliverables)

### Rust (`Cargo.toml`)

```toml
keyring = "3"     # D2 — OS keyring access
hmac = "0.12"     # D5 — IntegrityFile HMAC
sha2 = "0.10"     # D5 — SHA-256 for HMAC and SID-derived key
base64 = "0.22"   # D5 — encoding for HMAC field
# windows crate already pulled in transitively; verify feature flags for D4
```

### npm

None. `npm audit fix` will update the existing vite version but not add new packages.

---

## Out of Scope (deferred)

Findings F-07, F-08, F-11, F-12, F-13 are tracked in `SECURITY.md` but deliberately not in 0.4. Reasons in the SECURITY.md "Lower priority" table.

The following are noted in passing as v0.5+ work:

- **Authenticode code signing** — required for Option 2 of the privilege model (v1.1) and to remove SmartScreen warnings on install. Estimated cost: ~$300/year for the cert plus several hours of pipeline setup. Phase 0.5 work.
- **Auto-update mechanism with signed manifests** — Tauri 2 has an updater plugin but it's not configured. Configure once code signing is in place. Phase 0.5+ work.

---

## Pre-push Checklist (every PR)

- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds (no TS errors)
- [ ] `cargo audit` clean (after D5 lands; before D5 it's on you to run it manually)
- [ ] `npm audit --audit-level=high` clean (same)
- [ ] **CI green on `main`** — Phase 0.4 inherits Phase 1.0's requirement that CI must be functional as a tripwire
- [ ] PR description references PHASE-0.4-SPEC.md and the specific finding(s) from SECURITY.md being addressed
- [ ] If a finding is closed, update SECURITY.md to move it from "Planned" to "Fixed" with the closing PR/commit
