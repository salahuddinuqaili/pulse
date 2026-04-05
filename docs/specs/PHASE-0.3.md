# Phase 0.3 — "Connect Everything"

**Status:** Not Started
**Branch pattern:** `feat/phase-0.3-*`
**PRD scope:** FR-11 through FR-14
**Prerequisite:** Phase 0.2 shipped and stable

---

## Goal

Make Pulse externally accessible. AI tools can query GPU state via MCP. Users get proactive notifications. Workload profiles become actionable with recommendations. VRAM Budget Planner helps users plan model loading.

---

## Deliverables

### D1: MCP Server Integration (FR-13)

**New files:** `src-tauri/src/mcp.rs`, `src-tauri/src/mcp_handler.rs`
**Modified:** `lib.rs` (optional MCP startup), `commands.rs` (toggle MCP)

- [ ] Local MCP server (localhost only, configurable port)
- [ ] Resources exposed:
  - `gpu://status` — current GpuSnapshot
  - `gpu://vram/available` — free VRAM in MB
  - `gpu://vram/processes` — per-process VRAM list
  - `gpu://temperature` — current temps
  - `gpu://headroom` — headroom estimate with contextual guidance
- [ ] Toggle on/off from Settings → External Integrations
- [ ] Endpoint URL displayed for copy/paste into MCP client configs
- [ ] Security: localhost binding only, no authentication required for local

### D2: Smart Workload Profiles (FR-11)

**Modified:** `src/stores/profile-store.ts`, `src/components/headroom/*`

- [ ] Extend monitoring profiles with actionable recommendations:
  - "Gaming Only" — suggests VRAM-heavy texture settings the GPU can support
  - "Gaming + AI" — recommends model sizes and quantization levels alongside current game
  - "AI Workstation" — model capacity planning and batch size optimization
- [ ] Recommendations engine in Rust: given current VRAM state, suggest compatible workloads
- [ ] Frontend displays recommendations in QuickTune sidebar

### D3: VRAM Budget Planner (FR-12)

**New files:** `src/routes/vram-planner.tsx`, `src/components/planner/*`, `data/model-vram.yaml`

- [ ] Interactive calculator: "If I load [model X] at [quantization Y], I'll have [Z GB] left"
- [ ] Model VRAM database: community-maintained YAML mapping models to VRAM requirements
- [ ] Popular models pre-loaded: Llama 3 (8B/70B), Mistral, Phi, Stable Diffusion variants
- [ ] Visual: VRAM bar shows current usage + projected model usage + remaining free
- [ ] Multiple model stacking: add several models to see combined VRAM impact

### D4: Notification System (FR-14)

**New files:** `src-tauri/src/notifications.rs`
**Modified:** `poller.rs` (threshold detection), Settings screen

- [ ] Windows native notifications via Tauri notification plugin
- [ ] Configurable alerts:
  - VRAM exceeding threshold
  - Temperature exceeding threshold
  - Thermal throttling detected
  - AI process started/stopped
- [ ] Notification preferences in Settings (per-alert toggle, threshold values)
- [ ] Cooldown: don't spam repeated notifications (configurable, default 60s)

### D5: Settings — External Integrations

**Modified:** `src/routes/settings.tsx`

- [ ] MCP Connection: toggle + endpoint URL display + connection status
- [ ] Stream Deck Key: API key field (placeholder, integration in v1.0)
- [ ] OBS Password: masked input field (placeholder, integration in v1.0)
- [ ] Remove "Coming Soon" label from section header

---

## New Dependencies

- MCP SDK crate (or custom implementation over local HTTP/SSE)
- `tauri-plugin-notification` for Windows native notifications
- `serde_yaml` for model VRAM database parsing

---

## Out of Scope (deferred to v1.0)

- Hardware tuning (fan curves, clock offsets, power limits)
- Plugin API
- Multi-GPU support
- In-game overlay
- Stream Deck / OBS actual integration (only config fields in v0.3)
