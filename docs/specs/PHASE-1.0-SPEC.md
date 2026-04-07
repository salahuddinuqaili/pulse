# PHASE-1.0 Implementation Spec — "Control Everything"

**Status:** Ready for implementation
**Prerequisite:** Phase 0.3 shipped, **CI green** (see Prerequisites section)
**Branch pattern:** `feat/phase-1.0-*` (one branch per deliverable, PR to main)
**Decisions logged in:** `DECISIONS.md`

This phase introduces Pulse's first hardware-write operations. The architecture is built around a **single safety primitive** (the `HardwareWriteGuard`) that every write goes through. Multi-GPU support lands first so that every later deliverable is multi-GPU-aware from day one.

---

## Decisions Summary

| Decision | Choice | Rejected |
|---|---|---|
| Ship order | Multi-GPU first, then hardware tuning trio, then overlay, then plugin API, then benchmark DB | Hardware-first (would require multi-GPU rework later) |
| Safety stance | Standard: single confirm + bounded ranges + auto-revert + one-click revert | Maximum paranoia (slower to ship) and Power-user (insufficient guardrails for first hardware-write release) |
| Per-GPU snapshot model | `Vec<GpuSnapshot>` keyed by device index in `AppState` | Composite single-GPU snapshot with per-device fields (loses cleanliness and bloats `GpuSnapshot`) |
| Auto-revert mechanism | Persist "last known safe state" to `%APPDATA%/Pulse/restore.json` before every write; clear on clean exit | In-memory only (loses on crash) |
| Plugin sandbox model | **Deferred to D6 implementation** — flag as decision point | — |
| Benchmark DB backend | Out of scope for v1.0 — local recording only, submit endpoint stubbed | Full backend service in v1.0 (slips ship date) |

---

## Prerequisites

Before D1 work begins:

1. **CI must be green on `main`.** Currently red since Phase 0.2 because `tauri.conf.json` declares `resources/PresentMon-*-x64.exe` as a bundled resource and the binary isn't in the repo. Multi-GPU is a high-blast-radius refactor — you need CI as a tripwire. **Fix shipped separately as `fix/ci-presentmon-resource`** before D1 starts.
2. **Phase 0.3 manually verified on hardware.** Notifications fire, MCP server responds to `curl`, recommendations match the running profile.
3. **GitHub Release `v0.3.0` cut.** Gives users a stable "before-1.0" baseline they can roll back to if a Phase 1.0 deliverable destabilises something.

---

## Deliverable Order

| # | Deliverable | Branch | Risk | Estimated files |
|---|---|---|---|---|
| D1 | Multi-GPU Support | `feat/phase-1.0-multi-gpu` | High (refactor) | 2 new, ~12 modified |
| D2 | Hardware Write Foundation + Fan Curves | `feat/phase-1.0-fan-curves` | High (first GPU writes) | 3 new, 4 modified |
| D3 | Clock Offsets | `feat/phase-1.0-clock-offsets` | High (overclocking) | 1 new, 3 modified |
| D4 | Power Limits | `feat/phase-1.0-power-limits` | Medium (bounded by NVML caps) | 1 new, 3 modified |
| D5 | In-Game Overlay | `feat/phase-1.0-overlay` | Low (read-only) | 4 new, 3 modified |
| D6 | Plugin API | `feat/phase-1.0-plugin-api` | Medium (permanent contract) | 4 new, 4 modified |
| D7 | Community Benchmark DB | `feat/phase-1.0-benchmark-db` | Low (opt-in, stub backend) | 3 new, 2 modified |

---

## D1: Multi-GPU Support

### Approach

This is a refactor, not a feature. Move `AppState` from "the GPU" to "GPU `[i]`" everywhere. Every existing Phase 0.x feature must continue to work for single-GPU users without behavioural change. The frontend gains a GPU selector in the header.

The MCP resources shipped in Phase 0.3 (`gpu://status`, etc.) gain an indexed form (`gpu://0/status`, `gpu://1/status`) and the unindexed form remains as an alias for the **selected** device — preserving the JSON-RPC contract for any clients already integrated.

### New files

**`src-tauri/src/devices.rs`** — Device enumeration + per-device state container

```rust
pub struct DeviceManager {
    devices: Vec<DeviceState>,
    selected_index: Mutex<usize>,
}

pub struct DeviceState {
    pub index: u32,
    pub uuid: String,
    pub name: String,
    pub current_snapshot: Mutex<GpuSnapshot>,
}

impl DeviceManager {
    pub fn new() -> Result<Self, String>;     // enumerates via NVML
    pub fn count(&self) -> usize;
    pub fn get(&self, index: usize) -> Option<&DeviceState>;
    pub fn selected(&self) -> &DeviceState;
    pub fn set_selected(&self, index: usize) -> Result<(), String>;
}
```

**`src/components/shell/gpu-selector.tsx`** — Header dropdown listing all detected GPUs with utilization/VRAM at-a-glance.

### Modified files

- **`src-tauri/src/nvml.rs`** — every getter takes a `device_index: u32` parameter. The single `Nvml::init()` stays once-at-startup, but `get_device(index)` is called per request.
- **`src-tauri/src/state.rs`** — `AppState.current_snapshot: Mutex<GpuSnapshot>` becomes `device_manager: DeviceManager`. A `selected_snapshot()` accessor preserves the existing API for unchanged commands.
- **`src-tauri/src/poller.rs`** — outer loop iterates `0..device_count`, emits `gpu-snapshot` per device with a `device_index` field.
- **`src-tauri/src/types.rs`** — `GpuSnapshot` gains `device_index: u32` field. `DeviceInfo` becomes `Vec<DeviceInfo>` at the API boundary.
- **`src-tauri/src/commands.rs`** — `get_device_info` returns `Vec<DeviceInfo>`. Add `set_selected_device(index)`. `get_current_snapshot` accepts optional `device_index` (defaults to selected).
- **`src-tauri/src/mcp_handler.rs`** — add indexed routes:
  - `gpu://0/status`, `gpu://1/status`, etc.
  - `gpu://status` aliases to `gpu://{selected}/status` for backwards compat
  - New resource `gpu://devices` returning the device list
- **`src-tauri/src/notifications.rs`** — alerts include the device name in title for multi-GPU systems
- **`src-tauri/src/recommendations.rs`** — `generate_recommendations` runs per device; the QuickTune sidebar shows recommendations for the selected device
- **`src-tauri/src/session.rs`** — recordings include `device_index`; replay UI shows which device was recorded
- **`src/lib/types.ts`** — mirror Rust changes
- **`src/stores/gpu-store.ts`** — `current` becomes `Map<number, GpuSnapshot>`, `currentDeviceIndex` selector, `setCurrentDeviceIndex` action
- **`src/components/shell/header.tsx`** — embed `<GpuSelector />`
- **`src/hooks/use-gpu-listener.ts`** — listens for per-device events, routes to the right map slot

### Migration / backwards compat

- Settings `polling_interval_ms` and notification thresholds are still global, not per-device.
- Single-GPU users see no UI change — the GPU selector is hidden when `device_count == 1`.
- `gpu://status` MCP resource keeps returning the selected device so existing integrations don't break. New clients should use `gpu://devices` to discover indices, then `gpu://{i}/status`.

### Test plan

- [ ] Unit: `DeviceManager::new()` enumerates fake device fixtures correctly
- [ ] Unit: `set_selected` rejects out-of-range indices
- [ ] Unit: per-device `GpuSnapshot` serialization round-trips with `device_index`
- [ ] Manual: single-GPU system shows no selector, all Phase 0.x features unchanged
- [ ] Manual: dual-GPU system (or NVML simulator) shows two entries, switching updates dashboard
- [ ] Manual: MCP `resources/list` includes new indexed resources
- [ ] Manual: notifications fire with the device name prefix
- [ ] Manual: session replay shows the correct device's data
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

---

## D2: Hardware Write Foundation + Fan Curves

### Approach

This deliverable does double duty: it builds the **safety primitive** that D3 (clocks) and D4 (power) will reuse, and it ships the first user-visible hardware write — fan curve control.

The safety primitive is a `HardwareWriteGuard` struct that wraps every NVML write. Before any change, it persists the current state to `%APPDATA%/Pulse/restore.json`. On clean exit, the file is deleted. On startup, if the file exists, Pulse offers to revert to the saved state (interpreted as "previous run crashed mid-write").

### New dependencies

None. NVML write APIs are already available via `nvml-wrapper` v0.11.

### New files

**`src-tauri/src/tuning.rs`** — Hardware write primitives shared across D2/D3/D4

```rust
pub struct HardwareWriteGuard {
    restore_file: PathBuf,
    pending_writes: Mutex<Vec<PendingWrite>>,
}

pub enum PendingWrite {
    FanCurve { device_index: u32, original_curve: FanCurve },
    ClockOffsets { device_index: u32, original_core: i32, original_mem: i32 },
    PowerLimit { device_index: u32, original_mw: u32 },
}

impl HardwareWriteGuard {
    pub fn new(app_data_dir: PathBuf) -> Self;

    /// Capture current state and write it to restore.json BEFORE the change happens.
    /// Returns an error if the restore file can't be persisted — caller must abort.
    pub fn record(&self, write: PendingWrite) -> Result<(), String>;

    /// Called on clean app exit — clears the restore file.
    pub fn clear(&self);

    /// Called on startup — returns Some(state) if a previous crash left state to revert.
    pub fn check_for_orphaned_writes(&self) -> Option<Vec<PendingWrite>>;

    /// Apply all pending writes from a previous crash. Called after user confirmation.
    pub fn revert_orphaned(&self, state: Arc<DeviceManager>) -> Result<(), String>;
}
```

**`src-tauri/src/fan_curves.rs`** — Fan curve domain logic

```rust
#[derive(Clone, Serialize, Deserialize)]
pub struct FanCurvePoint {
    pub temperature_c: u32,
    pub fan_speed_pct: u32,  // 0-100
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FanCurve {
    pub points: Vec<FanCurvePoint>,  // sorted ascending by temp
}

impl FanCurve {
    pub fn validate(&self) -> Result<(), String>;     // monotonic, in-range, min floor enforced
    pub fn presets() -> Vec<(&'static str, FanCurve)>; // Silent, Balanced, Aggressive
    pub fn read_current(device_index: u32) -> Result<Self, String>;
    pub fn apply(&self, device_index: u32, guard: &HardwareWriteGuard) -> Result<(), String>;
    pub fn revert(device_index: u32, guard: &HardwareWriteGuard) -> Result<(), String>;
}
```

**Safety floors enforced in `validate`:**
- Minimum fan speed at any temperature ≥50°C is **30%** (never allow 0% when GPU is warm)
- Curve must be monotonic non-decreasing
- At least 2 points, at most 10
- Temperature points must be in `[20, 95]`

**`src/components/tuning/fan-curve-editor.tsx`** — Drag-points editor

Layout:
- SVG/Canvas chart, X = temperature (20–95°C), Y = fan speed (0–100%)
- Drag points to reshape; double-click empty space to add; right-click point to remove
- Preset buttons above: Silent / Balanced / Aggressive / Custom
- Live preview line that animates current temp marker
- "Apply" button → confirmation modal
- "Revert to default" button (always visible after first apply)

**`src/components/shared/hardware-write-confirm.tsx`** — Reused across D2/D3/D4

A modal with:
- Bold one-line summary of what will change
- Diff: "Current value → New value"
- Warning text appropriate to the operation
- "Cancel" (default focus) and "Apply" buttons
- Single-step — no typed acknowledgement (matches Standard safety stance)

### Modified files

- **`src-tauri/src/lib.rs`** — instantiate `HardwareWriteGuard` at boot, manage as Tauri state, register fan curve commands. Call `guard.clear()` in shutdown handler. Call `check_for_orphaned_writes()` after device init and emit a `pulse://orphaned-writes` event if found.
- **`src-tauri/src/commands.rs`** — `get_fan_curve(device_index)`, `set_fan_curve(device_index, curve)`, `revert_fan_curve(device_index)`, `get_fan_presets()`.
- **`src/routes/`** — new `/tuning/fan-curves` route
- **`src/components/shell/left-nav.tsx`** — add "Tuning" nav item with submenu (Fan Curves now, Clocks/Power coming in D3/D4)

### Test plan

- [ ] Unit: `FanCurve::validate` rejects 0% at 60°C
- [ ] Unit: `FanCurve::validate` rejects non-monotonic curves
- [ ] Unit: `HardwareWriteGuard::record` persists to disk before returning
- [ ] Unit: `HardwareWriteGuard::clear` removes the restore file
- [ ] Unit: orphaned-write detection finds a pre-existing restore.json
- [ ] Manual: applying a preset shows the confirmation modal
- [ ] Manual: cancel preserves current state
- [ ] Manual: apply updates fan speed visibly within 5s
- [ ] Manual: revert restores within 5s
- [ ] Manual: kill app mid-tuning, restart → orphaned-write prompt appears
- [ ] Manual: confirm orphaned-write revert restores original state
- [ ] `cargo clippy -- -D warnings` clean

---

## D3: Clock Offsets

### Approach

Reuses `HardwareWriteGuard` from D2. Slider UI for core/memory clock offsets. Bounded by NVML's reported safe range. Stability check after apply: 30s of utilization monitoring — if any error events appear in the snapshot stream, auto-revert with a warning toast.

### New files

**`src/components/tuning/clock-offset-editor.tsx`**
- Two sliders: Core clock offset, Memory clock offset
- Slider range = NVML reported `[min_offset, max_offset]`
- "Apply" → confirmation modal (warning text: "Overclocking may cause instability or rendering artifacts")
- After apply: 30s stability watch with countdown
- If errors or driver reset detected → auto-revert + toast
- Manual revert button always present

### Modified files

- **`src-tauri/src/tuning.rs`** — add `apply_clock_offsets`, `read_clock_offsets`, `clock_offset_range` (queries NVML for safe bounds)
- **`src-tauri/src/commands.rs`** — `get_clock_offsets`, `set_clock_offsets`, `revert_clock_offsets`, `get_clock_offset_range`
- **`src/routes/`** — `/tuning/clocks` route added under Tuning nav

### Safety bounds

- Core offset hard-clamped to NVML's reported range
- Additional sanity floor: never allow > 250 MHz core offset or > 1500 MHz memory offset on first apply (user must explicitly raise the limit in Settings)

### Test plan

- [ ] Unit: out-of-range offsets are rejected before NVML write
- [ ] Manual: slider only allows values in `[min, max]`
- [ ] Manual: apply triggers confirmation modal
- [ ] Manual: stability watch countdown is visible after apply
- [ ] Manual: simulated driver reset triggers auto-revert
- [ ] Manual: revert button restores stock clocks
- [ ] `cargo clippy -- -D warnings` clean

---

## D4: Power Limits

### Approach

Lowest-risk of the tuning trio because NVML enforces hard min/max bounds. Single slider from `min_power_w` to `max_power_w`. Includes an "estimated performance impact" hint based on the percentage reduction from default.

### New files

**`src/components/tuning/power-limit-editor.tsx`**
- Single slider, watts on the axis
- Default marker showing factory limit
- Performance impact hint: "Reducing to X W may lower performance by ~Y%" (rough heuristic, not measured)
- "Apply" → confirmation modal
- Revert button

### Modified files

- **`src-tauri/src/tuning.rs`** — add `apply_power_limit`, `read_power_limit`, `power_limit_range`
- **`src-tauri/src/commands.rs`** — corresponding commands
- **`src/routes/`** — `/tuning/power` route added under Tuning nav

### Test plan

- [ ] Unit: out-of-range power limits rejected
- [ ] Manual: slider clamped to NVML range
- [ ] Manual: apply triggers confirmation
- [ ] Manual: revert restores default
- [ ] `cargo clippy -- -D warnings` clean

---

## D5: In-Game Overlay

### Approach

A new transparent always-on-top window separate from the existing compact overlay. Configurable position (4 corners + drag-to-position), configurable metrics, transparency slider, global hotkey toggle. Pure read — no hardware writes.

### New dependencies

```toml
tauri-plugin-global-shortcut = "2"
```

### New files

- **`src/routes/in-game-overlay.tsx`** — the overlay route, rendered in the new transparent window
- **`src/components/overlay/overlay-metrics.tsx`** — minimal, high-contrast metric display
- **`src/components/overlay/overlay-settings.tsx`** — Settings panel section for position/metrics/hotkey/transparency
- **`src-tauri/src/overlay.rs`** — overlay window lifecycle + global hotkey registration

### Modified files

- **`src-tauri/src/lib.rs`** — register `tauri-plugin-global-shortcut`, manage overlay state, register the in-game overlay window separately from the existing compact overlay
- **`src-tauri/src/settings.rs`** — add `OverlayConfig { position, metrics: Vec<MetricKind>, transparency, hotkey, enabled }`
- **`src/routes/settings.tsx`** — add Overlay section

### Configurable metrics

User picks from: FPS, GPU temp, GPU util, VRAM used, VRAM free, core clock, memory clock, power draw. Each metric is a chip — drag to reorder.

### Position

- Preset corners: top-left, top-right, bottom-left, bottom-right
- Custom: drag the overlay to position; coordinates persist to settings.json

### Test plan

- [ ] Manual: hotkey toggles overlay visibility globally (works while in fullscreen game)
- [ ] Manual: position presets place overlay correctly on each monitor
- [ ] Manual: transparency slider updates in real time
- [ ] Manual: metric chips reorder via drag
- [ ] Manual: overlay survives fullscreen window switches
- [ ] Manual: overlay state persists across app restart
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `npm run build` succeeds

---

## D6: Plugin API

### Approach

**This deliverable has the largest design risk.** Plugin APIs are nearly impossible to retract once shipped — every wrong decision becomes permanent backwards-compat baggage. Implementation must start with a **decisions session** before code is written: the format (WASM? Lua? subprocess?), the security model, the event schema, and the action surface all need explicit user sign-off.

### Decisions to make BEFORE implementation

- **Plugin runtime:** WASM (sandboxed but limited), embedded Lua (familiar but tied to a runtime), subprocess (most flexible but heaviest), or in-process Rust dynamic library (fastest but unsandboxed)?
- **Discovery:** `%APPDATA%/Pulse/plugins/*.toml` manifests pointing at binaries? Or single self-describing file?
- **Hardware-write permissions:** can plugins request hardware writes (D2-D4)? If so, with what approval flow? Per-plugin-per-session opt-in? Persistent grant? Never?
- **Event subscription model:** push (Pulse calls plugin) or pull (plugin polls Pulse)?

**This spec deliberately stops here for D6.** When the user is ready, run a separate interview session to make these decisions, then write `PHASE-1.0-D6-SPEC.md` with the implementation plan.

### What this deliverable will eventually include

- Plugin discovery from `%APPDATA%/Pulse/plugins/`
- Read access to GPU snapshots (per-device)
- Custom dashboard widget API
- Custom data exporter API
- Discord Rich Presence as a reference plugin
- `docs/PLUGIN_API.md` with at least three working examples

### Test plan

To be defined with the implementation spec.

---

## D7: Community Benchmark Database

### Approach

**Backend service is out of scope for v1.0.** This deliverable ships only the local-recording side: Pulse can produce a benchmark report from a session recording, save it locally, and (if the user opts in) POST it to a stub endpoint. The actual community database service is post-v1.0.

### New files

- **`src-tauri/src/benchmarks.rs`** — Benchmark report generation from a session recording
- **`src/routes/benchmarks.tsx`** — Local benchmark history + opt-in submission UI
- **`src/components/benchmarks/benchmark-card.tsx`** — Per-benchmark card (game, FPS percentiles, hardware fingerprint)

### Hardware fingerprint (for similar-hardware comparison, anonymous)

- GPU model name
- Driver version
- VRAM total
- CUDA cores
- **Not collected:** username, hostname, IP, MAC, exact serial

### Modified files

- **`src-tauri/src/settings.rs`** — add `benchmark_submission_enabled: bool` (default `false`)
- **`src/components/shell/left-nav.tsx`** — add Benchmarks nav item

### Test plan

- [ ] Unit: benchmark report generation from a fixture session
- [ ] Unit: hardware fingerprint contains no PII
- [ ] Manual: benchmark route lists locally-saved reports
- [ ] Manual: opt-in toggle is OFF by default and clearly labelled
- [ ] Manual: submission to stub endpoint succeeds without network when opt-in is OFF
- [ ] `cargo clippy -- -D warnings` clean

---

## New Dependencies

### Rust (`Cargo.toml`)

```toml
tauri-plugin-global-shortcut = "2"  # D5 only
```

(NVML write APIs already available via existing `nvml-wrapper`. No new crate for the safety primitive — pure stdlib + serde.)

### npm — none

---

## Out of Scope (deferred to v1.1+)

These were considered during the spec interview and deliberately deferred:

- **AMD / Intel GPU support** — would require abstracting `nvml.rs` behind a `GpuBackend` trait and implementing ROCm + oneAPI backends. Months of architectural work; revisit after v1.0 ships and user demand is clear.
- **Linux port** — Tauri 2 supports Linux and NVML works on Linux, but process enumeration, tray behaviour, and global hotkeys all need Linux-specific code paths. Defer until there's a Linux user with bandwidth to test.
- **Cloud sync for profiles & sessions** — would be Pulse's first mandatory backend service. Keep Pulse fully local-first for v1.0; revisit when there's a user pulling for it.
- **Backend service for benchmark database** — D7 ships only the local-recording side. The community service comes after v1.0 with its own dedicated phase.
- **Plugin marketplace UI** — D6 ships filesystem-based discovery only. A marketplace is a v1.1+ feature.

---

## Pre-push Checklist (every PR)

- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds (no TS errors)
- [ ] **CI green** — Phase 1.0 explicitly requires CI as a tripwire because of refactor blast radius
- [ ] Both `types.rs` and `types.ts` updated if type contract changed
- [ ] Conventional commit messages
- [ ] PR description references PHASE-1.0-SPEC.md
- [ ] **For D2/D3/D4 (hardware writes):** PR description includes a "Tested on" line naming the GPU + driver version that was used to verify the write/revert cycle
