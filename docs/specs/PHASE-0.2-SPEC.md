# PHASE-0.2 Implementation Spec — "Understand Everything"

**Status:** Ready for implementation
**Prerequisite:** Phase 0.1 shipped (v0.1.0 on main)
**Branch pattern:** `feat/phase-0.2-*` (one branch per deliverable, PR to main)
**Decisions logged in:** `CLAUDE.md` Decision Log (2026-04-06 entries)

---

## Decisions Summary

| Decision | Choice | Rejected |
|---|---|---|
| FPS data source | PresentMon CLI subprocess (bundled, `--output_stdout`) | SDK FFI (too complex for v0.2), Raw ETW (reimplements PresentMon) |
| Chart library | uPlot (14KB, Canvas, streaming-native) | Chart.js (4x heavier), Recharts (SVG perf issues), Tremor/Visx (wrong fit) |
| Session storage | Hybrid: `.pulse` files (gzipped JSONL) + `sessions.db` (SQLite metadata cache) | SQLite-only (4x larger, no portable sharing), JSONL-only (slow analytics) |

**Long-term note:** Raw ETW frame-time capture (Option C) is a v1.0+ goal — eliminates PresentMon dependency entirely.

---

## Deliverable Order

| # | Deliverable | Branch | Risk | Estimated files |
|---|---|---|---|---|
| D1 | PresentMon integration | `feat/phase-0.2-presentmon` | High (external binary) | 3 new, 4 modified |
| D2 | Gaming Profile screen | `feat/phase-0.2-gaming-profile` | Medium (new route + charts) | 6 new, 2 modified |
| D3 | Session recording | `feat/phase-0.2-session-recording` | Medium (new backend module) | 4 new, 5 modified |
| D4 | Session replay + Ghost Delta | `feat/phase-0.2-ghost-delta` | Medium (replay UX) | 5 new, 2 modified |
| D5 | Hardware Analytics screen | `feat/phase-0.2-analytics` | Low (charts + queries) | 4 new, 2 modified |
| D6 | Enable nav items | `feat/phase-0.2-nav-enable` | Low | 0 new, 2 modified |

---

## D1: PresentMon Integration

### Approach

Bundle the PresentMon Console Application (`PresentMon-2.3.0-x64.exe`, MIT licensed, ~5MB) in the Tauri resource directory. Spawn it as a subprocess when a game process is detected, parse CSV stdout in real-time, compute FPS metrics, inject into `GpuSnapshot`.

### New files

**`src-tauri/src/presentmon.rs`** — PresentMon subprocess manager

```rust
// Core responsibilities:
// 1. Locate the bundled PresentMon binary (Tauri resource path)
// 2. Spawn PresentMon CLI targeting a specific process by name
// 3. Parse CSV stdout line-by-line into frame-time samples
// 4. Compute rolling metrics: FPS, avg FPS, frame_time_ms, 1% low, 0.1% low
// 5. Expose current metrics via a shared struct (Mutex-wrapped)
// 6. Graceful shutdown when game exits or stop is requested

use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;

pub struct FrameMetrics {
    pub fps_current: f32,
    pub fps_avg: f32,
    pub frame_time_ms: f32,
    pub fps_1pct_low: f32,
    pub fps_01pct_low: f32,
}

pub struct PresentMonManager {
    metrics: Arc<Mutex<Option<FrameMetrics>>>,
    active_process: Mutex<Option<tokio::process::Child>>,
}
```

**CLI invocation:**
```
PresentMon-2.3.0-x64.exe --process_name "game.exe" --output_stdout --terminate_on_proc_exit
```

**CSV output columns to parse:** `Application`, `ProcessID`, `TimeInSeconds`, `MsBetweenPresents`, `MsBetweenDisplayChange`

**FPS computation from frame times:**
- `fps_current` = 1000.0 / last `MsBetweenPresents`
- `fps_avg` = rolling average over last 60 samples
- `frame_time_ms` = last `MsBetweenPresents`
- `fps_1pct_low` = 1000.0 / (99th percentile of `MsBetweenPresents` over last 300 samples)
- `fps_01pct_low` = 1000.0 / (99.9th percentile of `MsBetweenPresents` over last 300 samples)

Keep a ring buffer of ~300 frame-time samples for percentile calculations.

**Graceful fallback:** If PresentMon binary not found at resource path, log a warning and leave all FPS fields as `None`. Frontend shows "—" with a tooltip: "PresentMon not available".

### Modified files

**`src-tauri/src/types.rs`** — Add FPS fields to `GpuSnapshot`:
```rust
// Add after pcie_link_width:
pub fps_current: Option<f32>,
pub fps_avg: Option<f32>,
pub frame_time_ms: Option<f32>,
pub fps_1pct_low: Option<f32>,
pub fps_01pct_low: Option<f32>,
```
Update `Default` impl to set all five as `None`.

**`src/lib/types.ts`** — Mirror the Rust changes:
```typescript
// Add after pcie_link_width:
fps_current: number | null;
fps_avg: number | null;
frame_time_ms: number | null;
fps_1pct_low: number | null;
fps_01pct_low: number | null;
```

**`src-tauri/src/poller.rs`** — Integrate PresentMon metrics into snapshot:
- Import `PresentMonManager` from `presentmon.rs`
- Accept an `Arc<PresentMonManager>` parameter (passed from `lib.rs`)
- Each fast-tier tick: read current `FrameMetrics` from the manager
- Populate `fps_current`, `fps_avg`, `frame_time_ms`, `fps_1pct_low`, `fps_01pct_low`
- Game detection trigger: when a process with category `Game` appears in the process list, call `presentmon_manager.start(game_name)`. When it disappears, call `presentmon_manager.stop()`.

**`src-tauri/src/lib.rs`** — Add `mod presentmon;`, create `PresentMonManager`, pass to poller.

**`src-tauri/Cargo.toml`** — No new dependencies needed (tokio subprocess already available).

### Tauri resource bundling

Add PresentMon binary to `src-tauri/tauri.conf.json` resources:
```json
{
  "bundle": {
    "resources": ["resources/PresentMon-2.3.0-x64.exe"]
  }
}
```

Place the binary at `src-tauri/resources/PresentMon-2.3.0-x64.exe`. Add to `.gitignore` (binary should be downloaded during build, not committed).

### Test plan
- [ ] PresentMon binary found: verify FPS fields populate when a game is running
- [ ] PresentMon binary missing: verify FPS fields are `None`, no crash, no error spam
- [ ] Game exits: verify PresentMon subprocess terminates cleanly
- [ ] Multiple game starts/stops: verify no zombie processes
- [ ] `cargo clippy -- -D warnings` passes

---

## D2: Gaming Profile Screen

### New files

**`src/routes/gaming-profile.tsx`** — Main route component

Layout (top to bottom):
1. **Game Hero Banner** — Full-width header with detected game name (from process classification). Dark gradient background. If no game detected: "No game running — start a game to see FPS data".
2. **FPS Counter** — Large number (Space Grotesk, 72px) showing `fps_current`. Smaller text below: "avg {fps_avg} | 1% low {fps_1pct_low}". Color: primary (#00FF66) when > 60fps, warning (#FF3366) when < 30fps, muted otherwise.
3. **Frame-Time Chart** — uPlot real-time line chart. X-axis: time (last 60s). Y-axis: frame time (ms). Primary green line. Target line at 16.67ms (60fps) as dashed muted line.
4. **Performance Consistency** — Bar chart showing frame-time distribution (histogram). Buckets: <8ms, 8-12ms, 12-16ms, 16-20ms, 20-33ms, 33ms+. Green bars for "good" ranges, red for "bad".
5. **Fan Curve Display** — Read-only visualization of fan speed vs temperature. Plot current operating point.

**`src/components/gaming/fps-counter.tsx`** — The large FPS display with 1% low indicators.

**`src/components/gaming/frame-time-chart.tsx`** — uPlot wrapper for real-time frame-time data.

```typescript
// uPlot config shape:
const opts: uPlot.Options = {
  width: containerWidth,
  height: 200,
  scales: { x: { time: true }, y: { auto: true } },
  series: [
    {}, // x-axis (timestamps)
    {
      label: "Frame Time",
      stroke: "#00FF66",
      width: 2,
      fill: "rgba(0, 255, 102, 0.1)",
    },
    {
      label: "60fps target",
      stroke: "#8B909A",
      width: 1,
      dash: [4, 4],
    },
  ],
  axes: [
    { stroke: "#8B909A", grid: { stroke: "rgba(139, 144, 154, 0.1)" } },
    { stroke: "#8B909A", grid: { stroke: "rgba(139, 144, 154, 0.1)" } },
  ],
};
```

**`src/components/gaming/frame-distribution.tsx`** — uPlot bar chart for frame-time histogram.

**`src/components/gaming/fan-curve.tsx`** — Read-only fan speed vs temp scatter/line chart.

**`src/components/gaming/game-hero.tsx`** — Game name banner with gradient background.

### Modified files

**`src/App.tsx`** — Add route: `<Route path="/gaming" element={<GamingProfile />} />`

**`src/stores/gpu-store.ts`** — Add a `frameTimeHistory` ring buffer (300 entries of `{timestamp: number, ms: number}`) populated from `frame_time_ms` field. Separate from the main snapshot history since frame-time charts need sub-second granularity.

### npm changes

```bash
npm install uplot uplot-react
npm uninstall chart.js react-chartjs-2
```

### Test plan
- [ ] Gaming Profile route renders without crash when no game running
- [ ] FPS counter shows "—" when `fps_current` is null
- [ ] Frame-time chart updates in real-time when data is available
- [ ] Chart respects design system colors (neon green on dark background)
- [ ] `npm run build` succeeds with no type errors

---

## D3: Session Recording

### Architecture

```
Recording flow:
  poller.rs emits snapshot
    → session.rs receives snapshot (if recording active)
    → serialize to JSON line
    → write through GzEncoder to .pulse file
    → on stop: compute aggregates → write to sessions.db

Storage:
  %APPDATA%/Pulse/sessions/
    ├── sessions.db           ← SQLite: metadata + aggregates (derived cache)
    ├── session-{uuid}.pulse  ← gzipped JSONL: full snapshot data
    ├── session-{uuid}.pulse
    └── ...
```

### New files

**`src-tauri/src/session.rs`** — Session recording engine

```rust
// Core types:

pub struct SessionMetadata {
    pub id: String,           // UUID
    pub start_ms: u64,
    pub end_ms: Option<u64>,
    pub interval_ms: u64,     // 1000 (default) or 100 (high-fidelity)
    pub gpu_name: String,
    pub game_detected: Option<String>,
    pub snapshot_count: u32,
    pub version: u32,         // format version, starts at 1
}

pub struct SessionAggregates {
    pub avg_temp: f32,
    pub max_temp: f32,
    pub avg_gpu_util: f32,
    pub max_gpu_util: f32,
    pub avg_vram_used_mb: f32,
    pub max_vram_used_mb: u32,
    pub avg_power_w: f32,
    pub max_power_w: f32,
    pub avg_fps: Option<f32>,
    pub max_fps: Option<f32>,
    pub avg_clock_graphics_mhz: f32,
    pub max_clock_graphics_mhz: u32,
}

pub struct SessionRecorder {
    // Manages the active recording:
    // - Opens gzip file writer on start
    // - Writes metadata header as first JSON line
    // - Appends each GpuSnapshot as a JSON line
    // - On stop: flushes gzip, computes aggregates, writes to SQLite
    // - Enforces max 60-minute duration
    // - Thread-safe: Arc<Mutex<RecorderState>>
}

pub struct SessionIndex {
    // SQLite wrapper for sessions.db:
    // - init(): create table if not exists, run reconciliation
    // - insert_session(): after recording stops
    // - list_sessions(): for session list UI
    // - get_session(): single session metadata
    // - delete_session(): remove from index + delete .pulse file
    // - reconcile(): scan .pulse files, rebuild any missing index entries
}
```

**SQLite schema (`sessions.db`):**
```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER,
    interval_ms INTEGER NOT NULL,
    gpu_name TEXT NOT NULL,
    game_detected TEXT,
    snapshot_count INTEGER NOT NULL DEFAULT 0,
    file_name TEXT NOT NULL,
    -- aggregates (filled on recording stop)
    avg_temp REAL,
    max_temp REAL,
    avg_gpu_util REAL,
    max_gpu_util REAL,
    avg_vram_used_mb REAL,
    max_vram_used_mb INTEGER,
    avg_power_w REAL,
    max_power_w REAL,
    avg_fps REAL,
    max_fps REAL,
    avg_clock_graphics_mhz REAL,
    max_clock_graphics_mhz INTEGER
);
```

**`.pulse` file format:**
```
[gzip stream]
Line 1: {"version":1,"id":"uuid","start_ms":1712434800000,"interval_ms":1000,"gpu_name":"RTX 5070","game_detected":"Cyberpunk 2077"}
Line 2: {full GpuSnapshot JSON}
Line 3: {full GpuSnapshot JSON}
...
Line N: {full GpuSnapshot JSON}
```

**`src/components/shared/session-controls.tsx`** — Recording controls for header bar

- Red circle icon when recording (pulses with CSS animation)
- Start button: triggers `start_recording` command
- Stop button: triggers `stop_recording` command
- Timer showing elapsed recording time
- Recording mode toggle: "Standard (1s)" / "High Fidelity (100ms)"

**`src/stores/session-store.ts`** — Frontend session state

```typescript
interface SessionState {
  isRecording: boolean;
  recordingStartMs: number | null;
  recordingMode: "standard" | "high-fidelity";
  sessions: SessionMetadata[];
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}
```

### Modified files

**`src-tauri/src/lib.rs`**
- Add `mod session;`
- Create `SessionRecorder` and `SessionIndex` in setup
- Pass `SessionRecorder` to poller (or register as managed state)
- Manage both as Tauri state

**`src-tauri/src/state.rs`**
- Add `recording_active: Mutex<bool>` to `AppState`
- Add `recording_interval_ms: Mutex<u64>` to `AppState`

**`src-tauri/src/poller.rs`**
- After emitting snapshot, if recording active: pass snapshot to `SessionRecorder::write_snapshot()`
- Check recording duration, auto-stop at 60 minutes

**`src-tauri/src/commands.rs`** — Add new commands:
```rust
#[tauri::command]
pub fn start_recording(
    recorder: State<Arc<SessionRecorder>>,
    state: State<Arc<AppState>>,
    interval_ms: u64,   // 1000 or 100
    gpu_name: String,
    game_detected: Option<String>,
) -> Result<String, String>  // returns session ID

#[tauri::command]
pub fn stop_recording(
    recorder: State<Arc<SessionRecorder>>,
    index: State<Arc<SessionIndex>>,
) -> Result<SessionMetadata, String>

#[tauri::command]
pub fn list_sessions(
    index: State<Arc<SessionIndex>>,
) -> Result<Vec<SessionMetadata>, String>

#[tauri::command]
pub fn load_session(
    index: State<Arc<SessionIndex>>,
    session_id: String,
) -> Result<Vec<GpuSnapshot>, String>  // reads full .pulse file

#[tauri::command]
pub fn delete_session(
    index: State<Arc<SessionIndex>>,
    session_id: String,
) -> Result<(), String>
```

**`src-tauri/src/types.rs`** — Add `SessionMetadata` struct (mirrors the Rust type above, with `Serialize`/`Deserialize`).

**`src/lib/types.ts`** — Add `SessionMetadata` interface.

**`src/components/shell/header.tsx`** — Add `<SessionControls />` component.

### Cargo.toml additions
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
flate2 = "1"
uuid = { version = "1", features = ["v4"] }
```

### Reconciliation (startup)

On app startup, `SessionIndex::reconcile()`:
1. List all `*.pulse` files in the sessions directory
2. For each file: read gzip header (first JSON line) to get metadata
3. Compare with SQLite rows
4. Insert missing sessions (files exist but not in SQLite)
5. Remove orphaned rows (SQLite row but no matching file)
6. Log any discrepancies via `tracing::warn!`

### Test plan
- [ ] Start recording: creates `.pulse` file in correct directory
- [ ] Stop recording: file contains valid gzipped JSONL, SQLite row exists
- [ ] List sessions: returns all recorded sessions with aggregates
- [ ] Load session: returns full snapshot array from `.pulse` file
- [ ] Delete session: removes both `.pulse` file and SQLite row
- [ ] 60-minute auto-stop: recording automatically stops
- [ ] Crash recovery: orphaned `.pulse` file gets indexed on next startup
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes

---

## D4: Session Replay + Ghost Delta

### New files

**`src/hooks/use-session-replay.ts`** — Replay playback engine

```typescript
interface ReplayState {
  session: GpuSnapshot[];
  ghostSession: GpuSnapshot[] | null;
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;  // 1x, 2x, 4x
}

// Manages:
// - Loading session data via load_session command
// - Playback timer (requestAnimationFrame or setInterval based on speed)
// - Seeking to specific index / timestamp
// - Loading a ghost (baseline) session for comparison
```

**`src/components/replay/replay-timeline.tsx`** — Timeline scrubber

- Full-width horizontal bar showing session duration
- Draggable playhead
- Ghost session overlay as translucent bar
- Click to seek

**`src/components/replay/replay-controls.tsx`** — Play/Pause, speed selector, ghost selector

- Play/Pause button
- Speed: 1x / 2x / 4x toggle
- "Select Ghost" button: opens session picker dialog
- "Clear Ghost" button
- Export dropdown: PNG snapshot, Markdown summary

**`src/components/replay/delta-indicators.tsx`** — Ghost delta comparison cards

- Temperature delta: "+3C" or "-5C" with color coding (green = better, red = worse)
- Clock delta: "+150 MHz" or "-200 MHz"
- Fan delta: "+10%" or "-5%"
- FPS delta (if available): "+15 FPS" or "-20 FPS"
- Each card shows: current value, ghost value, delta with arrow

**`src/components/replay/replay-chart.tsx`** — Dual-line uPlot chart

```typescript
// Two series on same chart:
// Series 1: Current session — solid line, primary green (#00FF66)
// Series 2: Ghost session — dashed line, muted (#8B909A), dash: [6, 4]
// Metric selector: dropdown to switch between temp, clocks, FPS, power, VRAM
```

**`src/routes/session-replay.tsx`** — Replay route (or modal/overlay over existing screens)

Layout:
1. Session info bar (name, date, duration, game detected)
2. Replay chart (dual-line with metric selector)
3. Delta indicator cards (if ghost loaded)
4. Timeline scrubber with playback controls

### Modified files

**`src/App.tsx`** — Add route: `<Route path="/replay/:sessionId" element={<SessionReplay />} />`

**`src/stores/session-store.ts`** — Add `currentReplayId` and `ghostSessionId` fields.

### Export features

**PNG snapshot:**
- Use uPlot's `toDataURL()` to capture chart canvas
- Overlay session metadata + current timestamp as text
- Trigger browser download

**Markdown summary:**
```markdown
# Pulse Session Summary
- **Game:** Cyberpunk 2077
- **Duration:** 45 min
- **Avg FPS:** 72.3 | **1% Low:** 54.1
- **Avg Temp:** 71C | **Max Temp:** 83C
- **Avg Power:** 245W
```

### Test plan
- [ ] Load a recorded session and replay it
- [ ] Timeline scrubbing seeks to correct timestamp
- [ ] Playback at 1x/2x/4x speeds works correctly
- [ ] Ghost session loads and displays as dashed overlay
- [ ] Delta indicators show correct values (current - ghost)
- [ ] PNG export downloads a valid image
- [ ] Markdown export generates correct summary
- [ ] Empty session list shows helpful message

---

## D5: Hardware Analytics Screen

### New files

**`src/routes/analytics.tsx`** — Main analytics route

Layout:
1. **Time-range tabs:** 1D / 1W / 1M (buttons, default 1D)
2. **Multi-metric timeline chart** — stacked uPlot charts (synced cursors):
   - Temperature chart (top)
   - Clock speeds chart (middle)
   - Fan speed chart (bottom)
   - Shared X-axis (time), crosshair synced across all three
3. **Recent Sessions list** — Table of sessions from SQLite index
   - Columns: Date, Game, Duration, Avg Temp, Avg FPS
   - Click to open replay
   - "Compare" button to load as ghost reference

**`src/components/analytics/time-range-tabs.tsx`** — 1D / 1W / 1M tab selector.

**`src/components/analytics/multi-metric-chart.tsx`** — Synced uPlot charts.

```typescript
// uPlot sync group for crosshair:
const syncKey = uPlot.sync("analytics");

// Three chart instances sharing the same sync key
// When cursor moves on one, all three update
```

**`src/components/analytics/session-list.tsx`** — Session table with sort/filter.

### Data flow for time-range views

The analytics screen does NOT load full session data. It queries `sessions.db` for aggregated metrics:

```sql
-- 1D: sessions from last 24 hours
SELECT * FROM sessions WHERE start_ms > ? ORDER BY start_ms DESC;

-- For the timeline chart: we need per-session data points
-- Each session becomes one data point on the chart (not per-snapshot)
-- X = session start time, Y = session aggregate (avg_temp, avg_clock, etc.)
```

For higher-resolution analytics (per-snapshot granularity within a time range), load individual `.pulse` files on demand when the user zooms in. Start with session-level granularity — it's fast and sufficient for 1D/1W/1M overviews.

### Modified files

**`src/App.tsx`** — Add route: `<Route path="/analytics" element={<Analytics />} />`

**`src/stores/session-store.ts`** — Add `loadSessionsInRange(startMs, endMs)` action.

### New Tauri command

**`src-tauri/src/commands.rs`** — Add:
```rust
#[tauri::command]
pub fn list_sessions_in_range(
    index: State<Arc<SessionIndex>>,
    start_ms: u64,
    end_ms: u64,
) -> Result<Vec<SessionMetadata>, String>
```

### Test plan
- [ ] Analytics route renders with time-range tabs
- [ ] 1D/1W/1M tabs filter sessions correctly
- [ ] Multi-metric charts render with synced crosshair
- [ ] Session list shows correct data from SQLite
- [ ] Click session to navigate to replay
- [ ] Empty state when no sessions in selected range
- [ ] `npm run build` succeeds

---

## D6: Enable Nav Items

### Modified files

**`src/components/shell/left-nav.tsx`**

```typescript
// Change:
{ label: "Gaming Profile", path: "/gaming", icon: "gamepad", enabled: false, badge: "v0.2" },
{ label: "Analytics", path: "/analytics", icon: "chart", enabled: false, badge: "v0.2" },

// To:
{ label: "Gaming Profile", path: "/gaming", icon: "gamepad", enabled: true },
{ label: "Analytics", path: "/analytics", icon: "chart", enabled: true },
```

Update version display from `v0.1.0` / `0.1` to `v0.2.0` / `0.2`.

### Test plan
- [ ] Gaming Profile nav item is clickable and navigates to `/gaming`
- [ ] Analytics nav item is clickable and navigates to `/analytics`
- [ ] No "v0.2" badges visible
- [ ] Version shows `v0.2.0`

---

## Full Type Contract Changes

### Rust (`src-tauri/src/types.rs`)

**GpuSnapshot** — add 5 fields:
```rust
pub fps_current: Option<f32>,
pub fps_avg: Option<f32>,
pub frame_time_ms: Option<f32>,
pub fps_1pct_low: Option<f32>,
pub fps_01pct_low: Option<f32>,
```

**New types:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub id: String,
    pub start_ms: u64,
    pub end_ms: Option<u64>,
    pub interval_ms: u64,
    pub gpu_name: String,
    pub game_detected: Option<String>,
    pub snapshot_count: u32,
    pub file_name: String,
    pub aggregates: Option<SessionAggregates>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionAggregates {
    pub avg_temp: f32,
    pub max_temp: f32,
    pub avg_gpu_util: f32,
    pub max_gpu_util: f32,
    pub avg_vram_used_mb: f32,
    pub max_vram_used_mb: u32,
    pub avg_power_w: f32,
    pub max_power_w: f32,
    pub avg_fps: Option<f32>,
    pub max_fps: Option<f32>,
    pub avg_clock_graphics_mhz: f32,
    pub max_clock_graphics_mhz: u32,
}
```

### TypeScript (`src/lib/types.ts`)

Mirror all Rust changes. Add:
```typescript
export interface SessionMetadata {
  id: string;
  start_ms: number;
  end_ms: number | null;
  interval_ms: number;
  gpu_name: string;
  game_detected: string | null;
  snapshot_count: number;
  file_name: string;
  aggregates: SessionAggregates | null;
}

export interface SessionAggregates {
  avg_temp: number;
  max_temp: number;
  avg_gpu_util: number;
  max_gpu_util: number;
  avg_vram_used_mb: number;
  max_vram_used_mb: number;
  avg_power_w: number;
  max_power_w: number;
  avg_fps: number | null;
  max_fps: number | null;
  avg_clock_graphics_mhz: number;
  max_clock_graphics_mhz: number;
}
```

---

## New Dependencies

### Rust (`Cargo.toml`)
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
flate2 = "1"
uuid = { version = "1", features = ["v4"] }
```

### npm (`package.json`)
```
+ uplot
+ uplot-react
- chart.js
- react-chartjs-2
```

---

## Pre-push Checklist (every PR)

- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds (no TS errors)
- [ ] Both `types.rs` and `types.ts` updated if type contract changed
- [ ] Conventional commit messages
- [ ] PR description references PHASE-0.2.md
