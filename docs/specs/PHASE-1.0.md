# Phase 1.0 — "Control Everything"

**Status:** Not Started
**Branch pattern:** `feat/phase-1.0-*`
**PRD scope:** v1.0 deliverables from ROADMAP.md
**Prerequisite:** Phase 0.3 shipped and stable

---

## Goal

First version that writes to GPU hardware. Users can tune fan curves, adjust clock offsets, and set power limits — all with extensive safety guards. Plugin API enables community extensions. Multi-GPU support.

---

## Critical Safety Principle

**Every hardware write operation must:**
1. Show a confirmation dialog explaining what will change and the risk
2. Validate the value is within safe bounds before writing
3. Log the change with before/after values
4. Provide a one-click "Revert to Default" action
5. Auto-revert on app crash or unexpected exit (fail-safe)

---

## Deliverables

### D1: Hardware Tuning — Fan Curves

**New files:** `src-tauri/src/tuning.rs`, `src/components/tuning/fan-curve-editor.tsx`

- [ ] Read current fan curve from NVML
- [ ] Visual fan curve editor: drag points on a temp→fan speed graph
- [ ] Presets: Silent, Balanced, Aggressive, Custom
- [ ] Write fan curve via NVML `nvmlDeviceSetFanSpeed_v2`
- [ ] Safety: minimum fan speed floor (never allow 0% when GPU > 50°C)
- [ ] Auto-revert: if app exits without explicitly saving, restore original curve

### D2: Hardware Tuning — Clock Offsets

**Modified:** `src-tauri/src/tuning.rs`
**New:** `src/components/tuning/clock-offset.tsx`

- [ ] Read current clock offsets
- [ ] Slider UI for core clock offset and memory clock offset
- [ ] Apply offset via NVML overclock APIs
- [ ] Safety bounds: limit offsets to manufacturer-safe ranges
- [ ] Stability test integration: run a brief stress test after applying offset
- [ ] Warning dialog: "Overclocking may cause instability. Proceed?"

### D3: Hardware Tuning — Power Limits

**Modified:** `src-tauri/src/tuning.rs`
**New:** `src/components/tuning/power-limit.tsx`

- [ ] Read current power limit and valid range from NVML
- [ ] Slider from min to max allowed power limit
- [ ] Apply via `nvmlDeviceSetPowerManagementLimit`
- [ ] Show impact estimate: "Reducing power limit may lower performance by ~X%"

### D4: Plugin API

**New files:** `src-tauri/src/plugin_api.rs`, `docs/PLUGIN_API.md`

- [ ] Define plugin interface: what data plugins can access, what actions they can take
- [ ] Plugin loading: discover plugins in `%APPDATA%/Pulse/plugins/`
- [ ] Plugin sandboxing: plugins cannot write to GPU hardware without user approval
- [ ] Example plugins: custom dashboard widget, data exporter, Discord Rich Presence
- [ ] Plugin API documentation with examples

### D5: Multi-GPU Support

**Modified:** `src-tauri/src/nvml.rs`, `state.rs`, `poller.rs`, `types.rs`

- [ ] Detect all NVIDIA GPUs via NVML device enumeration
- [ ] Per-GPU snapshots and state
- [ ] GPU selector in header/sidebar
- [ ] Process → GPU assignment display
- [ ] Combined VRAM view across GPUs

### D6: In-Game Overlay

**New files:** `src/components/overlay/*`

- [ ] Minimal always-on-top overlay for in-game use
- [ ] Customizable position (corner selector)
- [ ] Configurable metrics: FPS, temp, VRAM, clock speed
- [ ] Transparency slider
- [ ] Toggle via global hotkey

### D7: Community Benchmark Database

**New files:** `src-tauri/src/benchmarks.rs`, `src/routes/benchmarks.tsx`

- [ ] Submit anonymized benchmark results to community database
- [ ] Compare your GPU performance against similar hardware
- [ ] Per-game performance baselines
- [ ] Opt-in only — no data sent without explicit consent

---

## New Dependencies

- NVML write APIs (already available in nvml-wrapper)
- Global hotkey plugin for overlay toggle
- Network access for benchmark database (first time Pulse goes online — opt-in only)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Hardware damage from bad fan curve | Min fan floor, auto-revert on crash, confirmation dialogs |
| Instability from clock offsets | Bounded ranges, stability test, easy revert |
| Power limit too low → crash | Never allow below manufacturer minimum |
| Plugin security | Sandboxed execution, no hardware writes without approval |
| Benchmark data privacy | Anonymized, opt-in only, no PII collected |
