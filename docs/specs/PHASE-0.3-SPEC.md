# PHASE-0.3 Implementation Spec — "Connect Everything"

**Status:** Ready for implementation
**Prerequisite:** Phase 0.2 shipped (all 6 deliverables merged to main)
**Branch pattern:** `feat/phase-0.3-*` (one branch per deliverable, PR to main)
**Decisions logged in:** `CLAUDE.md` Decision Log

---

## Decisions Summary

| Decision | Choice | Rejected |
|---|---|---|
| MCP server transport | axum HTTP + SSE on localhost (custom MCP protocol impl) | Rust MCP SDK crate (immature ecosystem, unstable API) |
| Notification mechanism | tauri-plugin-notification (official Tauri plugin) | Custom Win32 toast notifications (reinvents the wheel) |
| Model VRAM database | TypeScript constant in `src/lib/model-database.ts` | YAML file + serde_yaml Rust crate (unnecessary backend dependency for frontend-only calculator) |

---

## Deliverable Order

| # | Deliverable | Branch | Risk | Estimated files |
|---|---|---|---|---|
| D1 | Notification System | `feat/phase-0.3-notifications` | Low (Tauri plugin) | 2 new, 4 modified |
| D2 | VRAM Budget Planner | `feat/phase-0.3-vram-planner` | Medium (new route + calculator) | 5 new, 2 modified |
| D3 | Smart Workload Profiles | `feat/phase-0.3-smart-profiles` | Medium (recommendations engine) | 3 new, 4 modified |
| D4 | MCP Server | `feat/phase-0.3-mcp-server` | High (new protocol) | 3 new, 3 modified |
| D5 | Settings — External Integrations | `feat/phase-0.3-settings-integrations` | Low | 0 new, 3 modified |

---

## D1: Notification System

### Approach

Use `tauri-plugin-notification` for native Windows toast notifications. Add a `notifications.rs` module that checks thresholds each polling tick and fires notifications with a configurable cooldown to prevent spam. Notification preferences are persisted in existing `settings.json`.

### New dependencies

**Cargo.toml:**
```toml
tauri-plugin-notification = "2"
```

**tauri.conf.json** — add plugin to capabilities.

### New files

**`src-tauri/src/notifications.rs`** — Threshold checker + notification dispatcher

```rust
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

pub struct NotificationManager {
    /// Cooldown tracking: alert_key → last_fired timestamp
    cooldowns: Mutex<HashMap<String, Instant>>,
    cooldown_duration_secs: u64, // default 60
}

pub enum AlertKind {
    VramThreshold,       // VRAM usage > user threshold %
    TempWarning,         // Temp > warning threshold
    TempCritical,        // Temp > critical threshold
    ThermalThrottle,     // Clock speed dropped while temp is high
    AiProcessStarted,    // New AI process detected
    AiProcessStopped,    // AI process exited
}

impl NotificationManager {
    pub fn new(cooldown_secs: u64) -> Self;

    /// Check snapshot against thresholds, fire notifications if needed.
    /// Called from poller.rs each tick.
    pub fn check_and_notify(
        &self,
        app_handle: &tauri::AppHandle,
        snapshot: &GpuSnapshot,
        prev_processes: &[ProcessInfo],
        settings: &NotificationSettings,
    );
}
```

**Notification settings** (added to existing `Settings` struct in `settings.rs`):
```rust
pub struct NotificationSettings {
    pub enabled: bool,
    pub vram_threshold_pct: u8,       // default 90
    pub temp_warning_c: u32,          // default from existing settings
    pub temp_critical_c: u32,         // default from existing settings
    pub thermal_throttle: bool,       // default true
    pub ai_process_events: bool,      // default true
    pub cooldown_secs: u64,           // default 60
}
```

### Modified files

**`src-tauri/src/settings.rs`** — Add `NotificationSettings` to `Settings` struct with defaults.

**`src-tauri/src/poller.rs`** — After emitting snapshot:
- Pass snapshot + previous process list to `NotificationManager::check_and_notify()`
- Keep a `prev_processes` cache for detecting AI process start/stop

**`src-tauri/src/lib.rs`** — Add `mod notifications;`, create `NotificationManager`, pass to poller. Add `tauri-plugin-notification` to plugin chain.

**`src/routes/settings.tsx`** — Add "Notifications" section with toggles:
- Master enable/disable
- Per-alert toggles (VRAM, Temp Warning, Temp Critical, Thermal Throttle, AI Process Events)
- VRAM threshold slider (50–99%)
- Cooldown slider (10–300s)

**`src-tauri/capabilities/default.json`** — Add notification permission.

### Thermal throttle detection logic

```
if current_clock_graphics < (max_observed_clock * 0.85) && temperature_c > temp_warning_threshold:
    → thermal throttle detected
```

Track `max_observed_clock` as the highest clock seen in the last 60 seconds.

### Test plan
- [ ] Notification fires when VRAM exceeds threshold
- [ ] Notification fires when temp exceeds warning/critical thresholds
- [ ] Thermal throttle detection works (clock drop + high temp)
- [ ] AI process start/stop notifications fire
- [ ] Cooldown prevents repeated notifications within window
- [ ] Disabled notifications don't fire
- [ ] Settings persist across restarts
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

---

## D2: VRAM Budget Planner

### Approach

Pure frontend calculator. A TypeScript constant holds known model VRAM requirements. User selects models from a dropdown, sees projected VRAM usage overlaid on current usage. No backend changes needed — reads current VRAM state from gpu-store.

### New files

**`src/lib/model-database.ts`** — Static model VRAM database

```typescript
export interface ModelEntry {
  name: string;
  family: string;
  params: string;        // "8B", "70B", etc.
  quantizations: {
    label: string;        // "Q4_K_M", "Q8_0", "FP16"
    vram_mb: number;
  }[];
}

export const MODEL_DATABASE: ModelEntry[] = [
  {
    name: "Llama 3.1 8B",
    family: "Llama",
    params: "8B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 5500 },
      { label: "Q8_0", vram_mb: 9200 },
      { label: "FP16", vram_mb: 16400 },
    ],
  },
  {
    name: "Llama 3.1 70B",
    family: "Llama",
    params: "70B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 40960 },
      { label: "Q8_0", vram_mb: 74000 },
    ],
  },
  {
    name: "Mistral 7B",
    family: "Mistral",
    params: "7B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 4800 },
      { label: "Q8_0", vram_mb: 8200 },
      { label: "FP16", vram_mb: 14800 },
    ],
  },
  {
    name: "Phi-3 Mini 3.8B",
    family: "Phi",
    params: "3.8B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 2800 },
      { label: "Q8_0", vram_mb: 4600 },
      { label: "FP16", vram_mb: 7800 },
    ],
  },
  {
    name: "Stable Diffusion XL",
    family: "Stable Diffusion",
    params: "SDXL",
    quantizations: [
      { label: "FP16", vram_mb: 6500 },
      { label: "FP32", vram_mb: 12000 },
    ],
  },
  {
    name: "FLUX.1 Dev",
    family: "FLUX",
    params: "12B",
    quantizations: [
      { label: "FP16", vram_mb: 10000 },
      { label: "FP8", vram_mb: 7000 },
    ],
  },
  // More can be added over time
];
```

**`src/routes/vram-planner.tsx`** — Main planner route

Layout (top to bottom):
1. **Current VRAM Bar** — Full-width bar showing current usage (used / total), colored by category
2. **Model Selector** — Dropdown to pick a model, then a quantization variant. "Add Model" button appends to the stack.
3. **Model Stack** — List of selected models with VRAM requirements. Each row: model name, quantization, VRAM (MB), remove button.
4. **Projected VRAM Bar** — Same bar as above but with projected model usage stacked on top of current usage. Green = fits, Red = exceeds total.
5. **Verdict** — Text: "These models will fit with X MB remaining" or "These models exceed available VRAM by X MB"

**`src/components/planner/model-selector.tsx`** — Dropdown for model + quantization selection.

**`src/components/planner/model-stack.tsx`** — List of selected models with remove button.

**`src/components/planner/vram-projection-bar.tsx`** — Stacked bar showing current + projected usage.

```typescript
// Projection calculation:
const currentUsedMb = snapshot.vram_used_mb;
const totalMb = snapshot.vram_total_mb;
const projectedMb = selectedModels.reduce((sum, m) => sum + m.vram_mb, 0);
const totalProjected = currentUsedMb + projectedMb;
const fits = totalProjected <= totalMb;
const remainingMb = totalMb - totalProjected;
```

### Modified files

**`src/App.tsx`** — Add route: `<Route path="/vram-planner" element={<VramPlanner />} />`

**`src/components/shell/left-nav.tsx`** — Add nav item:
```typescript
{ label: "VRAM Planner", path: "/vram-planner", icon: "calculator", enabled: true },
```
Add a `calculator` icon to the NavIcon component.

### Test plan
- [ ] Planner route renders with current VRAM bar
- [ ] Model selector lists all models from database
- [ ] Adding a model updates projected bar
- [ ] Stacking multiple models accumulates VRAM
- [ ] Red bar when projected exceeds total
- [ ] Remove model updates projection
- [ ] Verdict text is accurate
- [ ] `npm run build` succeeds

---

## D3: Smart Workload Profiles

### Approach

Extend the existing profile system with a Rust recommendations engine. Given current VRAM state and active processes, suggest compatible workloads. Display recommendations in the QuickTune sidebar.

### New files

**`src-tauri/src/recommendations.rs`** — Recommendations engine

```rust
pub struct Recommendation {
    pub category: RecommendationCategory,
    pub title: String,
    pub description: String,
    pub confidence: f32, // 0.0–1.0
}

pub enum RecommendationCategory {
    ModelFit,        // "You can load Llama 3.1 8B Q4"
    TextureBudget,   // "High textures will use ~2GB VRAM"
    Warning,         // "Loading another model may cause instability"
    Optimization,    // "Consider Q4 quantization to free VRAM"
}

/// Generate recommendations based on current GPU state.
pub fn generate_recommendations(
    free_vram_mb: u32,
    total_vram_mb: u32,
    active_profile: &str,     // "gaming", "ai", "gaming+ai"
    game_running: bool,
    ai_running: bool,
) -> Vec<Recommendation>;
```

Recommendation logic by profile:
- **Gaming Only** (game running, no AI): suggest texture quality levels based on free VRAM. >4GB = Ultra textures. 2-4GB = High. 1-2GB = Medium. <1GB = Low.
- **AI Workstation** (AI running, no game): suggest model sizes. Map free VRAM to compatible model names from the model database constants.
- **Gaming + AI** (both running): suggest model quantization downgrades to free VRAM for the game, or vice versa.
- **Idle** (neither running): show capacity overview — "This GPU can run X alongside Y."

**`src/components/shell/recommendations.tsx`** — Recommendation cards for QuickTune sidebar

```typescript
interface RecommendationCardProps {
  title: string;
  description: string;
  category: "model_fit" | "texture_budget" | "warning" | "optimization";
}
```

Color coding:
- `model_fit` → primary green
- `texture_budget` → primary green
- `warning` → warning red
- `optimization` → muted/amber

**`src-tauri/src/types.rs`** — Add `Recommendation` and `RecommendationCategory` types.

### Modified files

**`src-tauri/src/commands.rs`** — Add:
```rust
#[tauri::command]
pub fn get_recommendations(
    state: State<Arc<AppState>>,
) -> Vec<Recommendation>
```

**`src-tauri/src/lib.rs`** — Add `mod recommendations;`, register command.

**`src/stores/profile-store.ts`** — Extend with profile modes:
```typescript
type ProfileMode = "gaming" | "ai" | "gaming+ai" | "idle";
```
Auto-detect mode based on running processes.

**`src/components/shell/quick-tune.tsx`** — Replace "Coming in v0.2" placeholder with `<Recommendations />` component. Fetch recommendations on profile change or every 10 seconds.

### Test plan
- [ ] Gaming profile shows texture recommendations based on free VRAM
- [ ] AI profile shows compatible model suggestions
- [ ] Gaming+AI profile shows balanced recommendations
- [ ] Idle state shows capacity overview
- [ ] Recommendations update when VRAM state changes
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

---

## D4: MCP Server

### Approach

Embed an `axum` HTTP server inside the Tauri app, listening on localhost only. Implement the Model Context Protocol (JSON-RPC 2.0 over HTTP + SSE). Expose GPU state as MCP resources. The server is opt-in — toggled from Settings.

### New dependencies

**Cargo.toml:**
```toml
axum = "0.8"
tower = "0.5"
```

(`tokio` already present. `serde_json` already present.)

### New files

**`src-tauri/src/mcp.rs`** — MCP server lifecycle manager

```rust
pub struct McpServer {
    port: u16,
    shutdown_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    running: Mutex<bool>,
}

impl McpServer {
    pub fn new(port: u16) -> Self;

    /// Start the MCP HTTP server on localhost.
    pub async fn start(&self, state: Arc<AppState>) -> Result<(), String>;

    /// Stop the server gracefully.
    pub fn stop(&self);

    pub fn is_running(&self) -> bool;
    pub fn endpoint_url(&self) -> String; // "http://localhost:{port}"
}
```

**`src-tauri/src/mcp_handler.rs`** — MCP protocol handler (JSON-RPC 2.0 routes)

```rust
// axum routes:
// POST /message  — JSON-RPC 2.0 client→server messages
// GET  /sse      — Server-Sent Events for server→client messages

// Supported JSON-RPC methods:
// "initialize"       → server info + capabilities
// "resources/list"   → list available GPU resources
// "resources/read"   → read a specific resource by URI

// MCP Resources:
// gpu://status          → full GpuSnapshot as JSON
// gpu://vram/available  → { free_mb, total_mb, used_mb, utilization_pct }
// gpu://vram/processes  → array of { name, vram_mb, category }
// gpu://temperature     → { current_c, hotspot_c, warning_threshold, critical_threshold }
// gpu://headroom        → { free_mb, level, guidance_text }
```

**JSON-RPC message format:**
```json
// Request:
{ "jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": { "uri": "gpu://status" } }

// Response:
{ "jsonrpc": "2.0", "id": 1, "result": { "contents": [{ "uri": "gpu://status", "mimeType": "application/json", "text": "{...}" }] } }
```

### Modified files

**`src-tauri/src/lib.rs`** — Add `mod mcp; mod mcp_handler;`, create `McpServer`, manage as Tauri state. Start on app launch if settings.mcp_enabled is true.

**`src-tauri/src/commands.rs`** — Add:
```rust
#[tauri::command]
pub fn toggle_mcp(
    mcp: State<Arc<McpServer>>,
    state: State<Arc<AppState>>,
    enabled: bool,
) -> Result<String, String>  // returns endpoint URL or error

#[tauri::command]
pub fn get_mcp_status(
    mcp: State<Arc<McpServer>>,
) -> McpStatus  // { running: bool, endpoint_url: String, port: u16 }
```

**`src-tauri/src/settings.rs`** — Add MCP fields to Settings:
```rust
pub mcp_enabled: bool,    // default false
pub mcp_port: u16,        // default 9426
```

### Security

- Bind to `127.0.0.1` only — never `0.0.0.0`
- No authentication required (localhost-only access)
- Rate limit: 100 requests/second per client (reject with 429)

### Test plan
- [ ] MCP server starts on configured port
- [ ] `resources/list` returns all 5 GPU resources
- [ ] `resources/read` for each URI returns valid JSON
- [ ] SSE endpoint streams connection events
- [ ] Server stops cleanly on toggle off
- [ ] Server doesn't start when disabled in settings
- [ ] Localhost-only binding (reject non-loopback)
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds

---

## D5: Settings — External Integrations

### Modified files

**`src/routes/settings.tsx`** — Replace "Coming Soon" external integrations section with:

1. **MCP Connection**
   - Toggle switch (calls `toggle_mcp` command)
   - Status indicator: green dot "Connected" / gray dot "Disconnected"
   - Endpoint URL display with copy button: `http://localhost:9426`
   - Port number input (only editable when MCP is off)

2. **Stream Deck API Key** (placeholder)
   - Masked text input field
   - "Integration available in v1.0" note
   - Save button (persists to settings.json but no functionality)

3. **OBS WebSocket** (placeholder)
   - Masked password input field
   - Port input (default 4455)
   - "Integration available in v1.0" note
   - Save button (persists to settings.json but no functionality)

**`src-tauri/src/settings.rs`** — Add placeholder fields:
```rust
pub stream_deck_api_key: Option<String>,   // placeholder, not used yet
pub obs_ws_password: Option<String>,       // placeholder, not used yet
pub obs_ws_port: u16,                      // default 4455, placeholder
```

**`src/components/shell/left-nav.tsx`** — Remove "Coming Soon" styling from any remaining disabled items. Ensure VRAM Planner nav item is present (added in D2).

### Test plan
- [ ] MCP toggle starts/stops the server
- [ ] Endpoint URL displays correctly and copy button works
- [ ] Port is editable only when MCP is off
- [ ] Stream Deck and OBS fields save to settings.json
- [ ] "v1.0" labels are visible on placeholder integrations
- [ ] `npm run build` succeeds

---

## New Dependencies

### Rust (`Cargo.toml`)
```toml
tauri-plugin-notification = "2"
axum = "0.8"
tower = "0.5"
```

### npm — no new frontend dependencies

---

## Pre-push Checklist (every PR)

- [ ] `cargo clippy -- -D warnings` clean
- [ ] `cargo test` passes
- [ ] `npm run build` succeeds (no TS errors)
- [ ] Both `types.rs` and `types.ts` updated if type contract changed
- [ ] Conventional commit messages
- [ ] PR description references PHASE-0.3.md
