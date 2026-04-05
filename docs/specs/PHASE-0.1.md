# Phase 0.1 — "See Everything" (MVP)

**Status:** In Progress
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
- [ ] Rust toolchain installed (`rustup`)
- [ ] NVML available (NVIDIA GPU + drivers 470+)

---

## Deliverables

### D1: Rust Backend — Complete Data Pipeline

**Files:** `src-tauri/src/nvml.rs`, `poller.rs`, `process.rs`, `classify.rs`, `state.rs`, `commands.rs`

- [ ] NVML initializes on startup, emits `gpu-error` if unavailable
- [ ] Fast polling loop (1s): utilization, VRAM, temp, power, clocks
- [ ] Medium polling (2s): per-process VRAM via NVML + sysinfo enrichment
- [ ] Slow polling (5s): fan speed, PCIe info
- [ ] `get_device_info` command returns static GPU info
- [ ] `set_polling_interval` command adjusts interval (100–5000ms)
- [ ] Classification priority chain fully wired (user overrides, AI names, game paths, Python+torch, VRAM heuristic, system, unknown)
- [ ] All NVML errors handled gracefully — partial failures logged, added to `errors` vec, polling continues
- [ ] `AccessDenied` on process info → classify as unknown, log warning, never crash

**Acceptance:** Run `cargo test` in `src-tauri/` — all classify tests pass. Run `cargo tauri dev` — snapshots emit at 1s intervals visible in browser console.

### D2: Dashboard Screen (FR-1)

**Files:** `src/routes/dashboard.tsx`, `src/components/dashboard/*`, `src/components/vram/stacked-bar.tsx`, `src/components/headroom/headroom-indicator.tsx`

- [ ] GPU Hero Card: GPU name, VRAM ring (SVG), temperature (color-coded), clock speed, power bar, fan speed
- [ ] Headroom Indicator: free VRAM in GB, contextual guidance text, threshold-based coloring, pulsing animation at critical
- [ ] VRAM Stacked Bar: horizontal bar colored by category (AI purple, Game green, System gray, Free dark), segment labels
- [ ] Metric Cards: GPU utilization + spiking/steady label, memory controller %, PCIe link, FPS placeholder ("—")
- [ ] Performance Timeline: sparkline of last 60s GPU utilization from ring buffer
- [ ] Loading state: spinner + "Connecting to GPU..." when no snapshot yet
- [ ] Error state: clear message when NVML unavailable

**Acceptance:** Dashboard renders all cards with live-updating data. VRAM bar segments match process table entries. Headroom text changes with VRAM usage.

### D3: AI Workload Screen (FR-2)

**Files:** `src/routes/ai-workload.tsx`, `src/components/vram/block-map.tsx`, `src/components/vram/process-table.tsx`

- [ ] VRAM Block Map: canvas-based grid, 256MB per block, color-coded by process category
- [ ] Block hover tooltips: process name, PID, exact MB allocated
- [ ] Process Table: name, category badge, VRAM MB, PID — sorted by VRAM descending
- [ ] Power Draw meter: linear bar gauge (current W / limit W)
- [ ] Tensor Core Load placeholder: "not available" message (data not exposed by most consumer NVML)
- [ ] CUDA Detection banner: detect CUDA availability, show version or warning

**Acceptance:** Block map renders correct number of blocks for GPU VRAM. Hovering shows tooltip. Process table updates every 2s.

### D4: Settings Screen (FR-3)

**Files:** `src/routes/settings.tsx`

- [ ] Theme cards: System, Dark (default, active), Neon-Max — Dark selected by default
- [ ] Monitoring config: polling interval slider (Radix Slider, 100–5000ms), temperature thresholds, VRAM block size
- [ ] Behavior toggles: start minimized, launch at startup, compact overlay on minimize
- [ ] Custom Process Classification: add/remove AI process names, game process names
- [ ] External Integrations section: disabled, "Coming Soon" label
- [ ] Settings persist to `%APPDATA%/Pulse/settings.json`

**Acceptance:** Changing polling interval calls `set_polling_interval` and visibly changes update rate. Settings survive app restart.

### D5: System Tray + Compact Overlay (FR-4)

**Files:** `src-tauri/src/main.rs` (tray setup), new component `src/components/compact-overlay.tsx`

- [ ] System tray icon with tooltip: "GPU: XX% | VRAM: X.X/XX GB | Temp: XX°C"
- [ ] Left-click: restore main window
- [ ] Right-click menu: Show, Settings, Quit
- [ ] Compact Overlay: 320x480px always-on-top window with glassmorphism styling
- [ ] Overlay contents: FPS placeholder, temperature, VRAM bar

**Acceptance:** Minimizing to tray works. Tray tooltip updates with polling. Compact overlay floats above other windows.

### D6: Visual Polish — Design System Implementation

**Files:** All component files, `src/index.css`

- [ ] Apply Stitch design comps from `docs/design/stitch/` to all components
- [ ] VRAM ring: 120x120px, primary stroke, GB centered
- [ ] Temperature color-coding: green < 70°C, yellow < 85°C, red >= 85°C
- [ ] Neon glow on active states (`box-shadow: 0 0 15px rgba(0, 255, 102, 0.4)`)
- [ ] Left nav: 4px left border glow on active item
- [ ] No pure white anywhere — all text uses `#e5e1e4`
- [ ] Space Grotesk for all numbers, Manrope for body text
- [ ] Glassmorphism on compact overlay (surface-variant 60% opacity, backdrop-blur 24px)

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
