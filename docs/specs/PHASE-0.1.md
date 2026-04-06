# Phase 0.1 — "See Everything" (MVP)

**Status:** Complete (D1–D6 delivered, D7 deferred)
**Branch pattern:** `feat/phase-0.1-*`
**PRD scope:** FR-1 through FR-5
**Screens:** Dashboard, AI Workload, Settings + Compact Overlay

---

## Goal

Ship a working Tauri 2 desktop app that polls NVML in real time, classifies GPU processes, and displays unified telemetry across three screens. The user should be able to answer "What can my GPU do right now?" within 3 seconds of looking at Pulse.

---

## Prerequisites

- [x] Tauri 2 + React 19 + TypeScript scaffold
- [x] Rust backend module structure (nvml, poller, classify, process, state, commands, types)
- [x] Frontend shell (three-column layout, routing, stores, hooks)
- [x] Tailwind v4 with design system tokens
- [x] Rust toolchain installed (`rustup` + VS Build Tools MSVC)
- [x] Backend compiles (`cargo check` clean, `cargo test` 6/6 pass)
- [x] NVML available (NVIDIA GPU + drivers 470+) — verified with `cargo tauri dev`

---

## Deliverables

### D1: Rust Backend — Complete Data Pipeline

**Files:** `src-tauri/src/nvml.rs`, `poller.rs`, `process.rs`, `classify.rs`, `state.rs`, `commands.rs`

- [x] NVML initializes on startup, emits `gpu-error` if unavailable
- [x] Fast polling loop (1s): utilization, VRAM, temp, power, clocks
- [x] Medium polling (2s): per-process VRAM via NVML + sysinfo enrichment
- [x] Slow polling (5s): fan speed, PCIe info
- [x] `get_device_info` command returns static GPU info
- [x] `set_polling_interval` command adjusts interval (100–5000ms)
- [x] Classification priority chain fully wired (user overrides, AI names, game paths, Python+torch, VRAM heuristic, system, unknown)
- [x] All NVML errors handled gracefully — partial failures logged, added to `errors` vec, polling continues
- [x] `AccessDenied` on process info → classify as unknown, log warning, never crash

**Acceptance:** Run `cargo test` in `src-tauri/` — all classify tests pass. Run `cargo tauri dev` — snapshots emit at 1s intervals visible in browser console.

### D2: Dashboard Screen (FR-1)

**Files:** `src/routes/dashboard.tsx`, `src/components/dashboard/*`, `src/components/vram/stacked-bar.tsx`, `src/components/headroom/headroom-indicator.tsx`

- [x] GPU Hero Card: GPU name, VRAM ring (SVG), temperature (color-coded), clock speed, power bar, fan speed
- [x] Headroom Indicator: free VRAM in GB, contextual guidance text, threshold-based coloring, pulsing animation at critical
- [x] VRAM Stacked Bar: horizontal bar colored by category (AI purple, Game green, System gray, Free dark), segment labels
- [x] Metric Cards: GPU utilization + spiking/steady label, memory controller %, PCIe link, FPS placeholder ("—")
- [x] Performance Timeline: sparkline of last 60s GPU utilization from ring buffer
- [x] Loading state: spinner + "Connecting to GPU..." when no snapshot yet
- [x] Error state: clear message when NVML unavailable

**Acceptance:** Dashboard renders all cards with live-updating data. VRAM bar segments match process table entries. Headroom text changes with VRAM usage.

### D3: AI Workload Screen (FR-2)

**Files:** `src/routes/ai-workload.tsx`, `src/components/vram/block-map.tsx`, `src/components/vram/process-table.tsx`

- [x] VRAM Block Map: canvas-based grid, 256MB per block, color-coded by process category
- [x] Block hover tooltips: process name, PID, exact MB allocated
- [x] Process Table: name, category badge, VRAM MB, PID — sorted by VRAM descending
- [x] Power Draw meter: linear bar gauge (current W / limit W)
- [x] Tensor Core Load placeholder: "not available" message (data not exposed by most consumer NVML)
- [x] CUDA Detection banner: detect CUDA availability, show version or warning

**Acceptance:** Block map renders correct number of blocks for GPU VRAM. Hovering shows tooltip. Process table updates every 2s.

### D4: Settings Screen (FR-3)

**Files:** `src/routes/settings.tsx`

- [x] Theme cards: System, Dark (default, active), Neon-Max — Dark selected by default
- [x] Monitoring config: polling interval slider (Radix Slider, 100–5000ms), temperature thresholds, VRAM block size
- [x] Behavior toggles: start minimized, launch at startup, compact overlay on minimize
- [x] Custom Process Classification: add/remove AI process names, game process names
- [x] External Integrations section: disabled, "Coming Soon" label
- [x] Settings persist to `%APPDATA%/Pulse/settings.json`

**Acceptance:** Changing polling interval calls `set_polling_interval` and visibly changes update rate. Settings survive app restart.

### D5: System Tray + Compact Overlay (FR-4)

**Files:** `src-tauri/src/main.rs` (tray setup), new component `src/components/compact-overlay.tsx`

- [x] System tray icon with tooltip: "GPU: XX% | VRAM: X.X/XX GB | Temp: XX°C"
- [x] Left-click: restore main window
- [x] Right-click menu: Show, Settings, Quit
- [x] Compact Overlay: 320x480px always-on-top window with glassmorphism styling
- [x] Overlay contents: FPS placeholder, temperature, VRAM bar

**Acceptance:** Minimizing to tray works. Tray tooltip updates with polling. Compact overlay floats above other windows.

### D6: Visual Polish — Design System Implementation

**Files:** All component files, `src/index.css`

- [x] Apply Stitch design comps from `docs/design/stitch/` to all components
- [x] VRAM ring: 120x120px, primary stroke, GB centered
- [x] Temperature color-coding: green < 70°C, yellow < 85°C, red >= 85°C
- [x] Neon glow on active states (`box-shadow: 0 0 15px rgba(0, 255, 102, 0.4)`)
- [x] Left nav: 4px left border glow on active item
- [x] No pure white anywhere — all text uses `#e5e1e4`
- [x] Space Grotesk for all numbers, Manrope for body text
- [x] Glassmorphism on compact overlay (surface-variant 60% opacity, backdrop-blur 24px)

**Acceptance:** Visual diff against Stitch comps — layout, colors, and typography match.

### D7: Build + Release Pipeline

**Files:** `.github/workflows/build.yml`, `src-tauri/tauri.conf.json`

- [ ] GitHub Actions workflow: `windows-latest`, Rust toolchain, Node 20, `cargo tauri build`
- [ ] Produces `.msi` and `.exe` installer
- [ ] Auto-release on tag push via `softprops/action-gh-release`
- [ ] Installer size < 15MB

**Acceptance:** Push a tag → GitHub Actions produces downloadable installers.

---

## Non-Functional Targets

| Metric | Target |
|--------|--------|
| Launch to first data | < 2 seconds |
| CPU usage (visible, 1s poll) | < 3% |
| CPU usage (tray) | < 0.5% |
| Memory (total app) | < 80 MB |
| Installer size | < 15 MB |

---

## Out of Scope (deferred to v0.2+)

- FPS counter / PresentMon integration
- Gaming Profile screen
- Analytics screen
- Session recording / replay
- Ghost Delta comparison
- Hardware write operations
- MCP Server
- Notifications
