# Project: Pulse

Open-source GPU performance intelligence for gaming + AI workloads on Windows. NVIDIA-focused. Tauri 2 desktop app with an embedded Rust backend for hardware polling via NVML.

# Workflow

## Branching & PRs

- **`main`** is the stable trunk. Never push directly to `main` after initial scaffold.
- Every piece of work gets its own branch: `feat/`, `fix/`, `docs/`, `refactor/` prefix matching the commit type.
- Phase work branches off `main` as `feat/phase-X.Y-description` (e.g., `feat/phase-0.1-settings-persistence`).
- All changes come back via **Pull Request** to `main`. PRs must have a summary and test plan.
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Phase specs live in `docs/specs/PHASE-X.Y.md` — reference the relevant spec in PR descriptions.

## Phase Specs

Each milestone has a dedicated implementation spec:
- `docs/specs/PHASE-0.1.md` — "See Everything" (MVP): Dashboard, AI Workload, Settings, Tray
- `docs/specs/PHASE-0.2.md` — "Understand Everything": Gaming Profile, Sessions, Ghost Delta, Analytics
- `docs/specs/PHASE-0.3.md` — "Connect Everything": MCP Server, Notifications, VRAM Planner
- `docs/specs/PHASE-1.0.md` — "Control Everything": Hardware tuning, Plugins, Multi-GPU

Start each implementation session by reading the relevant phase spec. Mark deliverables as complete in the spec as you finish them.

# Stack

- **Tauri 2** — desktop framework, Rust backend + OS-native WebView2 frontend
- **React 19** with functional components and hooks (frontend in WebView2)
- **TypeScript** strict mode for all frontend code
- **Tailwind CSS v4** — `@theme` directive in `src/index.css`, no config file needed
- **Zustand** for state management (GPU metrics store, profile store, UI store)
- **Radix UI** for accessible primitives (Slider, Toggle, Tooltip, Dialog)
- **Rust** (2024 edition) — embedded backend, NOT a separate sidecar process
- **nvml-wrapper** crate (v0.11+, features: `serde`, `legacy-functions`) — safe NVML bindings
- **sysinfo** crate — cross-platform process enumeration (PID → name, path, command line)
- **tokio** — async runtime for polling loops and event emission
- **serde** + **serde_json** — serialization for Tauri IPC

# Design System

Visual implementation follows `docs/DESIGN.md` ("The Kinetic Darkroom"). Key rules:
- **Colors**: Primary `#00FF66`, Background `#0A0A0C`, Surface `#141519`, Warning `#FF3366`
- **Fonts**: Space Grotesk for metrics/headlines/labels, Manrope for body/descriptions
- **No borders for layout** — use tonal shifts between surface levels
- **No drop shadows** — use neon glow (`box-shadow: 0 0 15px rgba(0, 255, 102, 0.4)`) for active states
- **No pure white** — use `#e5e1e4` (on-surface) to prevent eye fatigue
- **All numbers in Space Grotesk** regardless of context

# Architecture

```
pulse/
├── src-tauri/                       # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs                  # Entry point — calls lib::run()
│   │   ├── lib.rs                   # App setup, NVML init, Tauri builder, poller start
│   │   ├── nvml.rs                  # NVML wrapper — ALL GPU queries go through here
│   │   ├── process.rs               # Process detection + sysinfo enrichment
│   │   ├── classify.rs              # Classification priority chain logic
│   │   ├── poller.rs                # Async polling loops (tiered: 1s/2s/5s)
│   │   ├── commands.rs              # #[tauri::command] functions exposed to frontend
│   │   ├── state.rs                 # AppState (current snapshot, generation, config)
│   │   └── types.rs                 # GpuSnapshot, ProcessInfo, DeviceInfo
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json
├── src/                             # React frontend (rendered in WebView2)
│   ├── main.tsx                     # ReactDOM entry point
│   ├── App.tsx                      # Three-column shell, routing, event listener setup
│   ├── index.css                    # Tailwind v4 @theme + design tokens
│   ├── routes/
│   │   ├── dashboard.tsx            # Dashboard screen (default)
│   │   ├── ai-workload.tsx          # AI Workload screen
│   │   └── settings.tsx             # Settings screen
│   ├── components/
│   │   ├── shell/                   # left-nav, header, quick-tune
│   │   ├── dashboard/               # gpu-hero-card, metric-cards, performance-timeline
│   │   ├── vram/                    # stacked-bar, block-map (canvas), process-table
│   │   ├── headroom/                # headroom-indicator
│   │   └── shared/                  # error-state, reusable primitives
│   ├── stores/
│   │   ├── gpu-store.ts             # Real-time GPU data (ring buffer, 300 entries)
│   │   ├── profile-store.ts         # Active monitoring profile (gaming/ai)
│   │   └── ui-store.ts              # Theme, sidebar collapsed state
│   ├── hooks/
│   │   ├── use-gpu-listener.ts      # Tauri event listener for gpu-snapshot
│   │   └── use-device-info.ts       # Invoke get_device_info on mount
│   └── lib/
│       ├── types.ts                 # TypeScript types mirroring Rust types.rs
│       ├── constants.ts             # Colors, thresholds, known process names
│       └── ring-buffer.ts           # Fixed-size circular buffer (BUFFER_SIZE=300)
├── docs/
│   ├── PRD.md                       # Product Requirements Document
│   ├── DESIGN.md                    # Design System ("The Kinetic Darkroom")
│   ├── specs/                       # Phase implementation specs
│   │   ├── PHASE-0.1.md
│   │   ├── PHASE-0.2.md
│   │   ├── PHASE-0.3.md
│   │   └── PHASE-1.0.md
│   ├── adr/                         # Architecture Decision Records
│   └── design/                      # Stitch exports and wireframes
├── CLAUDE.md                        # This file
├── README.md
├── ROADMAP.md
└── CONTRIBUTING.md
```

# Data Flow

1. `poller.rs` runs tiered async polling loops via tokio:
   - **Fast (1s):** GPU utilization, VRAM used/free, temperature, power, clocks
   - **Medium (2s):** Per-process VRAM breakdown (NVML + sysinfo)
   - **Slow (5s):** Fan speed, PCIe info
   - **Once at startup:** GPU name, driver version, VRAM total, CUDA cores
2. Each poll cycle merges results into a `GpuSnapshot` and updates `AppState`
3. `app_handle.emit("gpu-snapshot", &snapshot)` pushes to WebView2
4. Frontend `use-gpu-listener.ts` hook listens via `listen("gpu-snapshot", callback)`
5. Zustand `gpu-store` receives snapshots, writes to ring buffer (300 entries = 5 min at 1s)
6. React components subscribe to store slices via selectors (granular re-renders)

# Key Type Contract (Rust ↔ TypeScript)

**Source of truth:** `src-tauri/src/types.rs` (Rust) and `src/lib/types.ts` (TypeScript).
When modifying fields in either file, update both. See those files for the full type definitions.

Core types: `GpuSnapshot`, `ProcessInfo`, `DeviceInfo`, `ProcessCategory`.

# Process Classification Priority Chain

Implemented in `src-tauri/src/classify.rs`. Highest priority wins.

1. **User-defined overrides** (from Settings → Custom Process Classification)
2. **Exact executable name match** against known AI tools (ollama, comfyui, koboldcpp, etc.)
3. **Path-based game detection** (steamapps/common/, Epic Games/, GOG Galaxy/, XboxGames/)
4. **Command-line keyword match** (python with torch/cuda/transformers/diffusers) → "ai"
5. **VRAM heuristic** (>500MB, not matched above) → "game"
6. **Known system processes** (dwm.exe, csrss.exe, nvidia-related) → "system"
7. **Default** → "unknown"

Handle `AccessDenied` gracefully — never crash on inaccessible process info.

# Code Style

## TypeScript (frontend)
- ES modules only, never CommonJS
- Prefer named exports over default exports
- No `any` — use proper typing or `unknown`
- Zustand: one file per store, named exports, `immer` middleware for nested updates
- **Granular selectors:** `useGpuStore(s => s.current?.temperature_c)` not `useGpuStore(s => s.current)`
- VRAM block map: single `<canvas>` with coordinate hit testing, not React components per block

## Rust (backend)
- `Result<T, E>` everywhere — no `.unwrap()` in production code
- `.expect()` only with descriptive message in init code
- All NVML calls go through `nvml.rs` — never call nvml-wrapper directly from other modules
- `Nvml::init()` once at startup via `once_cell` — never reinitialise
- `tracing` crate for structured logging, not `println!`
- `main.rs` stays thin — `lib.rs` wires everything together
- `poller.rs` owns the polling loops and emits events — no business logic in `commands.rs`

# Commands

## Development
- `npm run dev` — Vite dev server (frontend only, hot reload)
- `cargo tauri dev` — full Tauri app with hot reload (frontend + backend)
- `cd src-tauri && cargo test` — backend tests
- `npm test` — frontend tests

## Build & Package
- `cargo tauri build` — production build (.msi + .exe installer)
- Output: `src-tauri/target/release/bundle/`

# Decision Log (append-only)

[2026-04-05] Tauri 2 over Electron — ~30MB idle RAM, ~10MB installer, no WebSocket layer, NVML in Rust backend directly. Portfolio shows framework range (Electron on Neon Protocol, Tauri on Pulse).

[2026-04-05] Tiered polling (1s/2s/5s) — process enumeration via sysinfo is expensive (~5-10ms). Tiered approach reduces CPU overhead by ~40%.

[2026-04-05] Ring buffer (300 entries) — avoids array growth, splice, GC pressure. Fixed memory footprint.

[2026-04-05] Canvas for VRAM block map — 96 blocks with hover/tooltips. Single canvas > 96 React components.

[2026-04-05] Radix UI for accessible primitives — unstyled, pairs with Tailwind. Avoids building a11y from scratch.

[2026-04-05] sysinfo crate for process enrichment — NVML returns PIDs + VRAM but not names/paths. Cache with 2s TTL.

[2026-04-05] Option<> wrappers on hardware-variable fields — not all GPUs report hotspot temp, fan RPM, PCIe. Prevents panics on unsupported hardware.

[2026-04-06] PresentMon CLI subprocess over SDK FFI — bundle CLI exe (~5MB, MIT), spawn with --output_stdout, parse CSV. Zero user setup, graceful fallback if missing. SDK FFI rejected (complex C bindings, requires service install). Raw ETW noted as long-term goal (v1.0+).

[2026-04-06] uPlot over Chart.js/Recharts — 14KB vs 73KB bundle, 4x less CPU for streaming time-series. Canvas rendering matches dark theme. Native ghost overlay (dash prop). Imperative API fine since AI generates code.

[2026-04-06] Hybrid session storage (JSONL + SQLite) — .pulse files (gzipped JSONL) are source of truth for recordings. SQLite sessions.db is a derived cache for metadata/aggregates (instant analytics, session list). If SQLite corrupts, auto-rebuild from .pulse headers. Rejected: SQLite-only (4x larger files, no portable sharing), JSONL-only (slow analytics at 1M scale).

[2026-04-06] axum HTTP + SSE for MCP server — custom MCP protocol implementation on localhost (127.0.0.1 only). Rust MCP SDK crate rejected (immature ecosystem, unstable API). axum + tokio already in dep tree via Tauri. JSON-RPC 2.0 messages over POST /message + GET /sse.

[2026-04-06] tauri-plugin-notification for alerts — official Tauri plugin for Windows toast notifications. Threshold-based alerts with configurable cooldown. Custom Win32 toast code rejected (reinvents the wheel).

[2026-04-06] TypeScript model database over YAML — VRAM planner is a pure frontend calculator. Static MODEL_DATABASE constant in src/lib/model-database.ts. serde_yaml Rust crate rejected (unnecessary backend dependency for frontend-only feature).
