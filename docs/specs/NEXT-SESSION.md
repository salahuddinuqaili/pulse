# Next Session: PHASE-0.2 — "Understand Everything"

## Current State

**PHASE-0.1 is complete and released as v0.1.0.**

Main branch contains a fully working Tauri 2 desktop app with:
- Rust backend: NVML polling (tiered 1s/2s/5s), process classification, settings persistence
- Frontend: Dashboard, AI Workload, Settings screens — all live-updating
- System tray with compact overlay window
- Visual polish matching Stitch design comps
- CI pipeline (lint + test + build) and release pipeline (tag → GitHub Release with MSI + EXE)

## PHASE-0.2 Goal

Add temporal intelligence — session recording, replay with ghost delta comparison, gaming profile with FPS data, and hardware analytics with historical charting.

## Deliverables (in recommended order)

### D1: PresentMon Integration (highest risk — spike first)
- New file: `src-tauri/src/presentmon.rs`
- Integrate Intel PresentMon SDK for frame-time capture (FPS, frame-time, 1%/0.1% lows)
- Add optional FPS fields to `GpuSnapshot` (both `types.rs` and `types.ts`)
- Graceful fallback when PresentMon unavailable
- **Risk:** PresentMon SDK is C/C++, needs FFI bindings or a CLI wrapper. Research options before committing to an approach.

### D2: Gaming Profile Screen
- New route `/gaming`, new files in `src/routes/gaming-profile.tsx` + `src/components/gaming/*`
- Game hero banner, FPS counter, frame-time chart (Chart.js), fan curve display
- Auto-activates when game process detected

### D3: Session Recording
- New file: `src-tauri/src/session.rs`
- Record `GpuSnapshot` stream to `.pulse` files (gzipped JSONL) in `%APPDATA%/Pulse/sessions/`
- Start/Stop button, configurable interval (1s default, 100ms high-fidelity), max 60 min
- New Tauri commands: `start_recording`, `stop_recording`, `list_sessions`

### D4: Session Replay + Ghost Delta
- Replay recorded sessions with timeline scrubbing
- Ghost reference overlay: solid line (current) + dashed line (baseline)
- Delta indicators for temp, clocks, fan speed
- Export: PNG snapshot or markdown summary

### D5: Hardware Analytics Screen
- New route `/analytics`, time-range tabs (1D/1W/1M)
- Multi-metric timeline chart with crosshair + tooltip
- Recent sessions list with ghost reference selector

### D6: Enable Disabled Nav Items
- Wire Gaming Profile + Analytics in left-nav, remove "v0.2" badges

## Key Decisions Needed

1. **PresentMon approach:** FFI bindings to PresentMon SDK vs. spawning PresentMon CLI as subprocess vs. ETW traces directly. Each has trade-offs — research before implementing.
2. **Chart library:** Current Phase 0.1 uses a custom SVG sparkline. Phase 0.2 needs real charts (frame-time, analytics). Chart.js is spec'd but alternatives (recharts, uPlot) may fit better.
3. **Session storage format:** Spec says gzipped JSONL. Consider whether this is sufficient for 60-min sessions at 100ms intervals (~36K snapshots).

## Architecture Changes

- `GpuSnapshot` gains 5 optional FPS/frame-time fields
- New `SessionMetadata` and `SessionEvent` types
- New `session.rs` module in backend
- New `presentmon.rs` module in backend
- 5 new Tauri commands for session management
- 2 new frontend routes + stores

## Environment

- Windows 11, RTX 5070 (12GB VRAM)
- Rust 1.94.1 stable (MSVC), Node 20, npm
- NVML available, CUDA available
- Docker available if needed for PresentMon SDK build
