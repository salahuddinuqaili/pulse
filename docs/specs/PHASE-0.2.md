# Phase 0.2 — "Understand Everything"

**Status:** Complete (PRs #13–#18 merged to main)
**Branch pattern:** `feat/phase-0.2-*`
**PRD scope:** FR-6 through FR-10
**Prerequisite:** Phase 0.1 shipped and stable

---

## Goal

Add temporal intelligence — users can record sessions, replay them, and compare against baselines. Gaming Profile screen with frame-time data via PresentMon. Hardware Analytics with historical charting.

---

## New Screens

- **Gaming Profile** (`/gaming`) — game-aware monitoring with FPS and frame-time
- **Hardware Analytics** (`/analytics`) — historical charting with time-range tabs

---

## Deliverables

### D1: PresentMon Integration

**New files:** `src-tauri/src/presentmon.rs`
**Modified:** `types.rs` (add frame-time fields to `GpuSnapshot`), `poller.rs` (integrate PresentMon polling)

- [x]Integrate Intel PresentMon SDK for frame-time capture
- [x]Metrics: FPS (instantaneous + average), frame-time graph, 1% low, 0.1% low
- [x]Frame-time data included in `GpuSnapshot` as optional fields
- [x]Graceful fallback when PresentMon unavailable (Dashboard FPS shows "—")

**Type contract changes:**
```
GpuSnapshot += {
  fps_current: Option<f32>
  fps_avg: Option<f32>
  frame_time_ms: Option<f32>
  fps_1pct_low: Option<f32>
  fps_01pct_low: Option<f32>
}
```

### D2: Gaming Profile Screen (FR-6)

**New files:** `src/routes/gaming-profile.tsx`, `src/components/gaming/*`

- [x]Game hero banner: detected game name from process, artwork via Steam API if available
- [x]FPS counter (large) with 99th percentile
- [x]Frame-time graph (line chart via Chart.js)
- [x]Performance Consistency bar chart (frame-time distribution)
- [x]Fan curve visualization (read-only display)
- [x]Auto-activates when game process detected, or manual via profile switcher

### D3: Session Recording (FR-7)

**New files:** `src-tauri/src/session.rs`, `src/components/shared/session-controls.tsx`
**Modified:** `state.rs` (recording state), `commands.rs` (start/stop/list recording commands)

- [x]Record full `GpuSnapshot` per tick + annotated events (process start/stop, threshold crossed, thermal throttle)
- [x]Start/Stop button in dashboard header
- [x]Configurable interval: default 1s, high-fidelity 100ms
- [x]Max duration: 60 minutes
- [x]Storage: `.pulse` files (gzipped JSONL) in `%APPDATA%/Pulse/sessions/`
- [x]Session list with metadata (duration, start time, game detected)

### D4: Session Replay + Ghost Delta (FR-8)

**New files:** `src/components/replay/*`, `src/hooks/use-session-replay.ts`

- [x]Replay a recorded session with timeline scrubbing
- [x]Ghost Reference selector: overlay a baseline session
- [x]Delta indicators: temperature delta, clock delta, fan velocity delta
- [x]Dual timeline: solid line (live/current) + dashed line (ghost)
- [x]Export: PNG snapshot at a point in time, or markdown summary

### D5: Hardware Analytics Screen (FR-9)

**New files:** `src/routes/analytics.tsx`, `src/components/analytics/*`

- [x]Time-range tabs: 1D, 1W, 1M
- [x]Multi-metric timeline chart (Temps, Clocks, Fans) with crosshair + tooltip
- [x]Recent Sessions list with Ghost Reference selector
- [x]Driver information and update check

### D6: Enable Disabled Nav Items

**Modified:** `src/components/shell/left-nav.tsx`

- [x]Gaming Profile nav item: enabled, routes to `/gaming`
- [x]Analytics nav item: enabled, routes to `/analytics`
- [x]Remove "v0.2" badges from these items

---

## Data Model Changes

- `GpuSnapshot` gains optional FPS/frame-time fields
- New `SessionMetadata` type for recorded sessions
- New `SessionEvent` type for annotated events (process start, threshold crossing)
- New Tauri commands: `start_recording`, `stop_recording`, `list_sessions`, `load_session`, `delete_session`

---

## Out of Scope (deferred to v0.3+)

- Smart workload profiles with recommendations
- VRAM Budget Planner
- MCP Server
- Notifications
- Hardware write operations
