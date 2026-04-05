# Phase 0.2 — "Understand Everything"

**Status:** Not Started
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

- [ ] Integrate Intel PresentMon SDK for frame-time capture
- [ ] Metrics: FPS (instantaneous + average), frame-time graph, 1% low, 0.1% low
- [ ] Frame-time data included in `GpuSnapshot` as optional fields
- [ ] Graceful fallback when PresentMon unavailable (Dashboard FPS shows "—")

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

- [ ] Game hero banner: detected game name from process, artwork via Steam API if available
- [ ] FPS counter (large) with 99th percentile
- [ ] Frame-time graph (line chart via Chart.js)
- [ ] Performance Consistency bar chart (frame-time distribution)
- [ ] Fan curve visualization (read-only display)
- [ ] Auto-activates when game process detected, or manual via profile switcher

### D3: Session Recording (FR-7)

**New files:** `src-tauri/src/session.rs`, `src/components/shared/session-controls.tsx`
**Modified:** `state.rs` (recording state), `commands.rs` (start/stop/list recording commands)

- [ ] Record full `GpuSnapshot` per tick + annotated events (process start/stop, threshold crossed, thermal throttle)
- [ ] Start/Stop button in dashboard header
- [ ] Configurable interval: default 1s, high-fidelity 100ms
- [ ] Max duration: 60 minutes
- [ ] Storage: `.pulse` files (gzipped JSONL) in `%APPDATA%/Pulse/sessions/`
- [ ] Session list with metadata (duration, start time, game detected)

### D4: Session Replay + Ghost Delta (FR-8)

**New files:** `src/components/replay/*`, `src/hooks/use-session-replay.ts`

- [ ] Replay a recorded session with timeline scrubbing
- [ ] Ghost Reference selector: overlay a baseline session
- [ ] Delta indicators: temperature delta, clock delta, fan velocity delta
- [ ] Dual timeline: solid line (live/current) + dashed line (ghost)
- [ ] Export: PNG snapshot at a point in time, or markdown summary

### D5: Hardware Analytics Screen (FR-9)

**New files:** `src/routes/analytics.tsx`, `src/components/analytics/*`

- [ ] Time-range tabs: 1D, 1W, 1M
- [ ] Multi-metric timeline chart (Temps, Clocks, Fans) with crosshair + tooltip
- [ ] Recent Sessions list with Ghost Reference selector
- [ ] Driver information and update check

### D6: Enable Disabled Nav Items

**Modified:** `src/components/shell/left-nav.tsx`

- [ ] Gaming Profile nav item: enabled, routes to `/gaming`
- [ ] Analytics nav item: enabled, routes to `/analytics`
- [ ] Remove "v0.2" badges from these items

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
