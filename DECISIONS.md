# Pulse - Decisions Log

Architecture decisions, library choices, and data model changes.
Format: `YYYY-MM-DD | Decision | Why | What was rejected`

---

<!-- Newest entries at the top -->

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
