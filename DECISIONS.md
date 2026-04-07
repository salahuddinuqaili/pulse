# Pulse - Decisions Log

Architecture decisions, library choices, and data model changes.
Format: `YYYY-MM-DD | Decision | Why | What was rejected`

---

<!-- Newest entries at the top -->

2026-04-08 | Phase 0.4 inserted between 0.3 and 1.0 | Security review found 6 high/medium findings (credential leak via cmd lines, plaintext API keys, MCP DNS rebinding, undecided privilege model, capability over-grant, restore.json tamper risk). Fix the foundation before adding hardware writes on top. | Folding fixes into 1.0 (less coherent release narrative, hardware writes blocked until security work done anyway)

2026-04-08 | Hardware-write privilege model: Option 1 in 0.4, commit to Option 2 in v1.1 | Detect non-admin and offer "Restart as administrator" UX. Single binary, no code signing required, ships in days not weeks. Migration to privilege-separated helper process (Option 2) is committed for v1.1 once Authenticode signing infrastructure is in place. | Option 2 in 0.4 (no signing yet, 1-2 weeks extra effort), Option 3 always-admin (terrible UX, elevates entire app including MCP server)

2026-04-08 | Single global toggle for command-line collection, OFF by default | Phase 0.4 D1 strips command lines at the source via one Settings flag. Easy to reason about, can't be misconfigured, defeats the credential leak in MCP responses and session recordings in one move. | Per-feature toggles (matrix of states confuses users), regex redaction at output (brittle, unstripped data still in memory)

2026-04-08 | OS keyring (Windows Credential Manager via `keyring` crate) for secret storage | Phase 0.4 D2 moves Stream Deck/OBS secrets out of plaintext settings.json into the OS keyring. Standard Windows pattern. Migration converts existing 0.3 plaintext entries on first 0.4 launch. | Encrypted file with passphrase (bad UX), in-memory only (loses on restart), Tauri Stronghold (overkill)

2026-04-08 | Allowlist Host header for MCP DNS rebinding defense | Phase 0.4 D3 rejects requests whose Host header isn't 127.0.0.1:{port} or localhost:{port}. Defeats DNS rebinding without breaking any legitimate caller. | Origin header check (not always sent), CSRF tokens (overkill for read-only), Bearer auth (defeats no-auth-on-localhost simplicity)

2026-04-08 | IntegrityFile<T> with HMAC-SHA256 keyed by SHA256(user_sid) | Phase 0.4 D5 introduces a tamper-resistant file primitive. Used by Phase 1.0's restore.json. Protects against accidental corruption and untargeted edits, which is the actual threat. Targeted local attacker can read SID — accepted scope. | Asymmetric signature (key storage problem), random key persisted to disk (same threat model + extra file to manage), no integrity (Phase 1.0 auto-revert could write garbage values from corrupted file)

2026-04-06 | TypeScript model database over YAML | VRAM planner is a pure frontend calculator. Static constant in src/lib/model-database.ts. | serde_yaml Rust crate (unnecessary backend dep for frontend-only feature)

2026-04-06 | tauri-plugin-notification for alerts | Official Tauri plugin for Windows toast notifications. Threshold-based alerts with configurable cooldown. | Custom Win32 toast code (reinvents the wheel)

2026-04-06 | axum HTTP + SSE for MCP server | Custom MCP protocol on localhost (127.0.0.1 only). axum + tokio already in dep tree. JSON-RPC 2.0 over POST /message + GET /sse. | Rust MCP SDK crate (immature ecosystem, unstable API)

2026-04-06 | Hybrid session storage (JSONL + SQLite) | .pulse files (gzipped JSONL) are source of truth. SQLite sessions.db is derived cache for metadata/aggregates. Auto-rebuild from .pulse headers if SQLite corrupts. | SQLite-only (4x larger, no portable sharing), JSONL-only (slow analytics at 1M scale)

2026-04-06 | uPlot over Chart.js/Recharts | 14KB vs 73KB bundle, 4x less CPU for streaming time-series. Canvas rendering matches dark theme. Imperative API fine since AI generates code. | Chart.js (heavy), Recharts (SVG perf issues)

2026-04-06 | PresentMon CLI subprocess over SDK FFI | Bundle CLI exe (~5MB, MIT), spawn with --output_stdout, parse CSV. Zero user setup, graceful fallback if missing. Raw ETW noted as v1.0+ goal. | SDK FFI (complex C bindings, requires service install)

2026-04-05 | Option<> wrappers on hardware-variable fields | Not all GPUs report hotspot temp, fan RPM, PCIe. Prevents panics on unsupported hardware. | Unwrap with defaults (crashes on edge-case GPUs)

2026-04-05 | sysinfo crate for process enrichment | NVML returns PIDs + VRAM but not names/paths. Cache with 2s TTL. | Manual Win32 process queries (more code, less portable)

2026-04-05 | Radix UI for accessible primitives | Unstyled, pairs with Tailwind. Avoids building a11y from scratch. | shadcn/ui (too opinionated), custom components (a11y burden)

2026-04-05 | Canvas for VRAM block map | 96 blocks with hover/tooltips. Single canvas > 96 React components. | React component per block (DOM thrashing at 96 elements)

2026-04-05 | Ring buffer (300 entries) | Avoids array growth, splice, GC pressure. Fixed memory footprint. 300 entries = 5 min at 1s polling. | Growing array with shift() (GC spikes)

2026-04-05 | Tiered polling (1s/2s/5s) | Process enumeration via sysinfo is expensive (~5-10ms). Tiered approach reduces CPU overhead by ~40%. | Single interval for all metrics (wasteful)

2026-04-05 | Tauri 2 over Electron | ~30MB idle RAM, ~10MB installer, no WebSocket layer, NVML in Rust backend directly. Portfolio shows framework range. | Electron (300MB+ RAM, 150MB installer)
