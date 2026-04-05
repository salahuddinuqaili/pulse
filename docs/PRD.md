# Pulse — Product Requirements Document

**Version:** 1.2
**Author:** Salahuddin
**Last Updated:** April 2026
**Status:** Pre-development
**Design System:** "The Kinetic Darkroom" (see `docs/DESIGN.md`)
**Changelog:**
- v1.1 → v1.2: Switched Electron → Tauri 2 (embedded Rust backend, no WebSocket sidecar). Tiered polling (1s/2s/5s). Ring buffer. Option<> wrappers. poll_generation + errors fields. sysinfo crate. Canvas VRAM block map. Chart.js canvas. Radix UI. Tauri bundler. CI on windows-latest.
- v1.0 → v1.1: Expanded MVP to 3 screens, monitoring profiles, Stitch design system, VRAM block map, Ghost Delta (v0.2), MCP (v0.3), naming locked to Pulse.

---

## 1. Product Overview

### 1.1 Problem Statement

Modern NVIDIA gaming GPUs are increasingly used for dual purposes: gaming and local AI inference (Ollama, LM Studio, ComfyUI, llama.cpp). Users running both workloads on the same GPU face a fragmented monitoring experience — they must juggle 3–4 separate tools (MSI Afterburner, nvidia-smi, HWiNFO, Task Manager) none of which understand the relationship between gaming and AI workloads or answer the most fundamental question: **"What can my GPU do right now?"**

No existing tool provides process-level VRAM attribution with workload classification, VRAM headroom estimation, or a unified view of gaming and AI performance in a single, modern interface.

### 1.2 Product Vision

Pulse is the first open-source GPU performance monitor built for the dual-use era. It treats gaming and local AI as first-class citizens in the same dashboard, providing real-time intelligence that helps users understand, balance, and optimize how their GPU is being shared across workloads.

### 1.3 One-Liner

**"See what your GPU is doing. Know what it can still do."**

### 1.4 Target Platform

- Windows 10/11 (64-bit)
- NVIDIA GPUs with driver version 470+ (NVML support)
- Primary target hardware: RTX 3060 through RTX 5090 (12–32GB VRAM)

### 1.5 License

MIT — maximally permissive for community adoption and portfolio visibility.

### 1.6 Naming

The product name is **Pulse**. No NVIDIA branding in the product name or UI chrome. The GPU card on the dashboard displays the detected hardware name (e.g., "NVIDIA GeForce RTX 5070") as reported by NVML — this is hardware identification, not brand association.

The internal design language is called **"The Kinetic Darkroom"** — this name appears only in design documentation, never in the user-facing product.

---

## 2. Target Users

### 2.1 Primary Persona: The Dual-Use Gamer

**Profile:** Owns an RTX 3060–5070 class GPU. Runs Ollama or LM Studio alongside Steam games. Active on r/LocalLLaMA, r/pcgaming, or both.

**Key behaviors:**
- Checks nvidia-smi in terminal to see VRAM before launching a game
- Alt-tabs to Afterburner during gameplay to check thermals
- Has crashed a game by running too large an LLM model without realizing VRAM was exhausted

**Success metric:** User can determine "can I launch this game while Ollama is loaded?" in under 3 seconds from looking at Pulse.

### 2.2 Secondary Persona: The Local AI Builder

**Profile:** Runs multiple AI workloads (inference, image generation, embeddings). Uses nvitop or nvidia-smi obsessively. Wants a GUI alternative to CLI monitoring.

**Success metric:** User can see per-process VRAM, identify which model is consuming what, and detect RAM spill within 5 seconds.

### 2.3 Tertiary Persona: The Performance Optimizer

**Profile:** Enthusiast who benchmarks every game. Posts frame-time graphs on forums.

**Success metric:** User can record a session and compare it against a previous baseline (v0.2).

### 2.4 Non-Target Users (v0.1–v1.0)

- Server/data center operators (use DCGM/Prometheus)
- AMD GPU users (deferred to community plugin in v1.0+)
- Users who want to overclock or modify GPU settings (Pulse is read-only through v0.3; hardware tuning is v1.0+)

---

## 3. App Shell

All screens share a consistent three-column layout derived from the Stitch design comps.

### 3.1 Layout Structure

```
┌──────────┬────────────────────────────────┬─────────────┐
│ Left Nav │        Main Content            │ Quick-Tune  │
│  ~60px   │        (scrollable)            │  Sidebar    │
│ collapsed│                                │   ~240px    │
│ ~200px   │                                │             │
│ expanded │                                │             │
└──────────┴────────────────────────────────┴─────────────┘
```

### 3.2 Left Navigation

**Background:** `surface-container-low` (tonal separation from main content, no border — per design system "No-Line Rule").

**Items (v0.1):**
| Icon | Label | Route | Status |
|------|-------|-------|--------|
| Dashboard grid | Dashboard | `/` | Active |
| AI chip | AI Workload | `/ai-workload` | Active |
| Settings gear | Settings | `/settings` | Active |
| Gamepad | Gaming Profile | `/gaming` | Disabled, "v0.2" badge |
| Chart | Analytics | `/analytics` | Disabled, "v0.2" badge |

**Active state:** 4px left border in `primary` (#00FF66) + neon-colored text. Per design system: "Left-Border Glow" that fades into background.

**Bottom:** App version badge (e.g., "V.0.1.0") and Studio Health indicator.

### 3.3 Quick-Tune Sidebar (Right)

**Background:** `surface-container-low`. Visually separated from main content via tonal shift, not borders.

**v0.1 Contents:**
- **Monitoring Profile Switcher:** Toggle between "Gaming View" and "AI View" display presets. This changes which metrics are prominent on the Dashboard — it does NOT write to GPU hardware.
- **System Status:** Connection indicator (sidecar live/disconnected), polling interval display.
- **Expand Panel:** Toggles sidebar between compact (icons only, ~60px) and full width (~240px).

**v0.2+ Contents (disabled/hidden in v0.1):**
- Silent Mode toggle
- Max Fans toggle
- Clear VRAM action
- These require hardware write APIs and are scoped to v1.0.

### 3.4 Top Header

- **Left:** Pulse logo + active profile pill (e.g., "● GAMING PROFILE" or "● AI WORKLOAD")
- **Center:** Compact Mode toggle (switches to system tray overlay)
- **Right:** Notification bell (v0.2), user avatar/settings shortcut

---

## 4. Functional Requirements — v0.1 (MVP)

### FR-1: Dashboard Screen

**Priority:** P0
**Route:** `/` (default)

The primary screen showing unified GPU telemetry. Layout adapts based on the active monitoring profile.

#### FR-1.1: GPU Hero Card

A dominant card spanning the main content area showing the GPU identity and primary metrics.

| Element | Data Source | Display |
|---------|------------|---------|
| GPU Name | NVML `nvmlDeviceGetName` | "NVIDIA GeForce RTX 5070" in Space Grotesk headline |
| VRAM Ring | NVML `nvmlDeviceGetMemoryInfo_v2` | Circular progress ring (120x120px, primary stroke) with GB value centered |
| Temperature | NVML `nvmlDeviceGetTemperature` | Large numeral + °C, color-coded (green/yellow/red) |
| Clock Speed | NVML `nvmlDeviceGetClockInfo` | MHz in Space Grotesk |
| Power Draw | NVML `nvmlDeviceGetPowerUsage` | Current W / Limit W with linear bar gauge |
| Fan Speed | NVML `nvmlDeviceGetFanSpeed_v2` | RPM value |

**Visual reference:** Stitch Dashboard v2 (Image 4 from first batch) — the GPU card with VRAM ring, temp, clock, power, and fan.

#### FR-1.2: VRAM Stacked Bar (Dashboard Compact View)

A horizontal bar below the GPU Hero Card showing proportional VRAM usage by process with color-coded categories.

| Category | Color | Detection |
|----------|-------|-----------|
| AI/ML | Purple (`#9333EA`) | Executable name or command line match |
| Game | Green (`#00FF66` primary) | Steam/Epic/GOG path or VRAM heuristic |
| System | Gray (`surface-container-highest`) | Driver/system processes |
| Free | Dark (`surface-container-lowest`) | Remaining VRAM |

Each segment labeled with process name and MB/GB value. Clicking a segment navigates to AI Workload screen for detail.

#### FR-1.3: System Stat Cards

A row of compact cards below the VRAM bar showing supplementary system context.

| Card | Data | Source |
|------|------|--------|
| System RAM | Used / Total GB, speed | Windows Performance Counters |
| NVMe SSD | Used / Total TB | WMI |
| Live FPS | Current FPS + stability label | PresentMon (v0.2, show "—" in v0.1) |
| GPU Utilization | Percentage + "Steady"/"Spiking" label | NVML |

#### FR-1.4: Performance Stream Timeline

A sparkline/bar chart at the bottom of the dashboard showing the last 60 seconds of GPU utilization as a timeline. Toggle between LIVE and LOG views (LOG is v0.2 — shows session history).

**Visual reference:** Stitch Dashboard v2 — the "Performance Stream: Last 60 Minutes Telemetry" section.

#### FR-1.5: Headroom Indicator

Prominently displayed on the Dashboard (exact placement: within GPU Hero Card or as a dedicated card above the VRAM bar).

**Display:** Large "X.X GB Available" with contextual guidance text.

| VRAM Free | Color | Guidance Text |
|-----------|-------|---------------|
| >8GB | Green | "Comfortable headroom — room for a 14B Q4 model or a demanding game" |
| 4–8GB | Yellow | "Moderate headroom — a 7B Q4 model or a mid-range game would fit" |
| 2–4GB | Orange | "Limited — only small models (3B) or lightweight games" |
| <2GB | Red | "Tight — additional workloads risk instability" |
| <500MB | Red (pulsing) | "Critical — VRAM nearly exhausted" |

Guidance text adapts contextually: if Ollama is loaded, it says "X GB available after [model name]."

**Acceptance criteria:**
- Headroom value updates every poll cycle
- Contextual text reflects currently detected processes
- Thresholds are user-configurable in Settings

### FR-2: AI Workload Screen

**Priority:** P0
**Route:** `/ai-workload`

The differentiator screen. No competing tool offers this view.

#### FR-2.1: VRAM Block Map

A grid visualization of the GPU's total VRAM, divided into blocks representing memory allocation.

**Visual reference:** Stitch AI Workload v2 (Image 1 from first batch) — the block grid with FREE (green), SYSTEM (gray), ACTIVE AI (white/dark) blocks.

| Block State | Color | Meaning |
|-------------|-------|---------|
| Free | Primary green (`#00FF66`) | Available VRAM |
| System | Light gray | Driver/OS reserved |
| Active AI | White/bright | AI process allocation |
| Active Game | Teal (when in dual-use) | Game process allocation |

**Block size:** Each block represents a fixed VRAM quantum (e.g., 256MB per block for a 12GB card = 48 blocks). Grid wraps to fill available width.

**Interaction:** Hovering a block shows a tooltip with the owning process name, PID, and exact MB allocated. This implements the "VRAM Heatmap Depth" feature from the Stitch feature enhancements doc.

**Header:** "VRAM Block Map" with "X.X GB / Y.Y GB" and "ACTIVE ALLOCATION" label, matching the Stitch design.

#### FR-2.2: Active AI Processes Table

Below the block map, a table listing all detected AI/ML processes.

| Column | Data |
|--------|------|
| Status indicator | Green dot (active), yellow (idle), red (error) |
| Process Name | Name with classification tag, e.g., "ollama_server.exe" or "python.exe (torch)" |
| Memory Load | VRAM in MB |
| Core ID | CUDA device assignment (e.g., "CUDA:0") |
| Uptime | Duration since process started |
| Actions | v0.2: Kill button. v0.1: info tooltip only |

**Table actions bar:** "Export Logs" (export process list as JSON/CSV) and "Clear Zombies" (v0.2 — kills orphaned CUDA processes).

#### FR-2.3: Power Draw Meter

Linear bar gauge showing current wattage against TDP limit. Labeled with idle and peak thresholds.

**Visual reference:** Stitch AI Workload v2 — the "POWER DRAW 320W / 450W" card.

#### FR-2.4: Tensor Core Load Timeline

Bar chart showing tensor core utilization over time, if available via NVML. Labeled "TENSOR CORE LOAD TIMELINE" with "LIVE TRACE" badge.

**Note:** Tensor core utilization is only available on certain GPU models/driver versions via NVML. If unavailable, this component shows "Tensor data not available for this GPU/driver" and collapses gracefully.

#### FR-2.5: CUDA Detection Banner

A status banner below the power/tensor section: "AI PROFILE OPTIMIZED: CUDA X.X DETECTED" (green check) or "CUDA NOT DETECTED" (warning).

### FR-3: Settings Screen

**Priority:** P1
**Route:** `/settings`

#### FR-3.1: Theme Selection

Three options displayed as selectable cards:
- **System** — follows Windows theme
- **Dark** — the default Kinetic Darkroom dark theme
- **Neon-Max** — full intensity glow effects, increased primary saturation

**Visual reference:** Stitch Settings screen (Image 3 from second batch).

#### FR-3.2: Monitoring Configuration

| Setting | Default | Range |
|---------|---------|-------|
| Polling interval | 1000ms | 100ms – 5000ms |
| Temperature thresholds (green/yellow/red) | 70°C / 85°C | User-configurable |
| VRAM headroom thresholds | 8GB / 4GB / 2GB / 500MB | User-configurable |
| VRAM block size | Auto (based on total VRAM) | 128MB / 256MB / 512MB |

#### FR-3.3: Behavior

| Setting | Default |
|---------|---------|
| Start minimized to tray | Off |
| Launch at Windows startup | Off |
| Compact overlay on minimize | On |

#### FR-3.4: Custom Process Classification

User-editable lists for:
- Additional AI process names (beyond built-in list)
- Additional game process names / paths
- Processes to exclude from monitoring

#### FR-3.5: External Integrations (v0.3 placeholder)

Section visible but disabled in v0.1, with "Coming Soon" label:
- **MCP Connection** — toggle + endpoint URL field
- **Stream Deck Key** — API key field
- **OBS Password** — masked input

**Visual reference:** Stitch Settings screen — the "MCP (Model Context Protocol) Connection" section and "External Integrations" section.

**Persistence:** All settings stored in `%APPDATA%/Pulse/settings.json`.

### FR-4: System Tray / Compact Overlay

**Priority:** P0

#### FR-4.1: System Tray

- Tray icon with hover tooltip: "GPU: XX% | VRAM: X.X/XX GB | Temp: XX°C"
- Left-click: restore main window
- Right-click: context menu (Show, Settings, Quit)

#### FR-4.2: Compact Overlay Window

A minimal, always-on-top window (~320x480px) showing critical telemetry.

**Contents:**
- Frame Rate (large numeral + "FPS" — shows "—" until PresentMon in v0.2)
- Thermal State (temperature in °C)
- VRAM Allocation (compact bar with used/total)

**Visual reference:** Stitch Compact Overlay (Image 3 from first batch) — the glassmorphic floating panel.

**Styling:** Glassmorphism per design system (surface-variant at 60% opacity, backdrop-blur 24px, primary-tinted shadow).

**Controls:**
- Expand button (opens main window)
- Close button (minimizes to tray)

### FR-5: GPU Information Panel

**Priority:** P1

Collapsible panel accessible from Dashboard (gear/info icon on GPU Hero Card).

| Field | Source |
|-------|--------|
| GPU Name | NVML |
| Driver Version | NVML |
| VRAM Total | NVML |
| PCIe Link Speed/Width | NVML |
| CUDA Cores | Lookup table by GPU model |
| TDP / Power Limit | NVML |
| VBIOS Version | NVML |

---

## 5. Functional Requirements — v0.2

### FR-6: Gaming Profile Screen

**Route:** `/gaming`

Game-aware monitoring view. Activates automatically when a game process is detected, or manually via profile switcher.

**Key components:**
- Game hero banner (game name detected from process, with artwork if available via Steam API)
- FPS counter (large) with 99th percentile
- Frame-time graph (PresentMon integration)
- Performance Consistency bar chart (frame-time distribution)
- Fan curve visualization (read-only display of current curve, not editable in v0.2)

**Visual reference:** Stitch Gaming Profile screens (Images 6, 7 from first batch; Image 1 from second batch).

### FR-7: Session Recording

Record a complete GPU performance session as a time-series dataset.

**Recorded data per tick:** Full GpuSnapshot + per-process VRAM + annotated events (process start/stop, VRAM threshold crossed, thermal throttle).

**Controls:** Start/Stop button in dashboard header. Configurable interval (default 1s, high-fidelity 100ms). Max duration 60 minutes.

**Storage:** `.pulse` files (gzipped JSONL) in `%APPDATA%/Pulse/sessions/`.

### FR-8: Session Replay with Ghost Delta

Replay a recorded session with timeline scrubbing, plus overlay a "ghost" reference session for comparative analysis.

**Ghost Delta concept** (from Stitch Hardware Analytics screen):
- User selects a recorded session as the "Ghost Reference"
- Live or replayed data is overlaid with ghost data
- Delta indicators show differences: temperature delta (e.g., "-2.4°C"), clock delta ("+42 MHz"), fan velocity delta ("MATCHED")
- The timeline shows both "LIVE SESSION" (solid line) and "GHOST" (dashed line)

**Visual reference:** Stitch Hardware Analytics (Image 2 from second batch) — the Ghost Delta cards and dual-line timeline.

**Export:** PNG snapshot of dashboard at a point in time, or markdown summary.

### FR-9: Hardware Analytics Screen

**Route:** `/analytics`

**Key components:**
- Time-range tabs (1D, 1W, 1M)
- Multi-metric timeline chart (Temps, Clocks, Fans) with cursor crosshair and tooltip
- Recent Sessions list with Ghost Reference selector
- Driver information and update check

**Visual reference:** Stitch Hardware Analytics (Image 2 from second batch).

### FR-10: PresentMon Integration

Integrate Intel's PresentMon SDK for frame-time capture.

**Metrics:** FPS (instantaneous + average), frame-time graph, 1% low, 0.1% low, frame-time variance.

Frame-time data included in session recordings and displayed on Gaming Profile screen.

---

## 6. Functional Requirements — v0.3

### FR-11: Workload Profiles with Recommendations

Extend monitoring profiles to include actionable recommendations:
- "Gaming Only" — suggests VRAM-heavy texture settings your GPU can support
- "Gaming + AI" — recommends model sizes and quantization levels that fit alongside current game
- "AI Workstation" — focuses on model capacity planning and batch size optimization

### FR-12: VRAM Budget Planner

Interactive calculator: "If I load [model X] at [quantization Y], I'll have [Z GB] left."

Data source: community-maintained YAML file mapping models to VRAM requirements. Updated via GitHub.

### FR-13: MCP Server Integration

The Rust sidecar exposes a local MCP (Model Context Protocol) server alongside its WebSocket.

**Purpose:** AI tools (Claude Desktop, Ollama-aware IDEs, custom agents) can query hardware state programmatically.

**MCP Resources exposed:**
- `gpu://status` — current GpuSnapshot
- `gpu://vram/available` — free VRAM in MB
- `gpu://vram/processes` — per-process VRAM list
- `gpu://temperature` — current temps
- `gpu://headroom` — headroom estimate with contextual guidance

**Configuration:** Toggle on/off in Settings → External Integrations. Endpoint URL displayed for copy/paste into MCP client configs.

**Visual reference:** Stitch Settings screen — the MCP section with toggle and endpoint field.

### FR-14: Notification System

Configurable alerts via Windows native notifications:
- VRAM exceeding threshold
- Temperature exceeding threshold
- Thermal throttling detected
- AI process started/stopped

---

## 7. Non-Functional Requirements

### NFR-1: Performance

| Metric | Target |
|--------|--------|
| App launch to first data display | <2 seconds |
| CPU usage (dashboard visible, 1s polling) | <3% |
| CPU usage (minimized to tray) | <0.5% |
| Memory usage (Tauri app total) | <80MB |
| Installer size | <15MB |

### NFR-2: Reliability

- Sidecar handles NVML errors gracefully (GPU not found, driver crash, access denied)
- If sidecar crashes, Electron detects within 5s and restarts (max 3 retries)
- Frontend shows clear "Sidecar disconnected" state, never stale data
- Settings corruption never crashes the app — fallback to defaults with logged warning

### NFR-3: Compatibility

- Windows 10 (21H2+) and Windows 11
- NVIDIA driver 470+ (NVML v11+)
- Multi-monitor support (window remembers position per monitor config)
- High-DPI display support (100%, 125%, 150%, 200% scaling)

### NFR-4: Security

- No network access required (fully offline)
- No telemetry, no analytics, no phone-home
- Tauri deny-by-default permission model — only explicitly granted capabilities enabled
- No elevated privileges required (NVML works user-space on consumer GPUs)
- MCP server (v0.3) binds to localhost only

### NFR-5: Accessibility

- All interactive elements keyboard-navigable
- Color coding supplemented with icons/text (not color-only)
- WCAG 2.1 AA contrast ratios
- Screen reader labels on key metrics

### NFR-6: Installability

- Windows installer (.msi and .exe) via Tauri bundler
- Portable mode (runs from folder, no install required)
- Installer size target: <15MB (Tauri uses OS WebView2, no bundled Chromium)
- WebView2 bootstrapper included for Windows 10 systems that lack it
- Clean uninstall (removes app data, user settings require opt-in to delete)
- Auto-updates via Tauri updater plugin checking GitHub Releases

---

## 8. Technical Architecture

### 8.1 System Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Tauri 2 Application                 │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │          WebView2 Frontend (React 19)        │    │
│  │          Zustand + Tailwind + Radix UI        │    │
│  │                                               │    │
│  │  ┌──────────┐ ┌───────────┐ ┌────────────┐   │    │
│  │  │gpu-store │ │profile-   │ │ui-store    │   │    │
│  │  │(ring buf)│ │store      │ │(theme/etc) │   │    │
│  │  └────▲─────┘ └───────────┘ └────────────┘   │    │
│  │       │ Zustand update                        │    │
│  │  ┌────┴───────────────────────┐               │    │
│  │  │ use-gpu-listener hook      │               │    │
│  │  │ listen("gpu-snapshot", cb) │               │    │
│  │  └────▲───────────────────────┘               │    │
│  └───────┼───────────────────────────────────────┘    │
│          │ Tauri IPC (no network, no WebSocket)       │
│  ┌───────┼───────────────────────────────────────┐    │
│  │       │   Rust Backend                        │    │
│  │  ┌────┴─────┐ ┌──────────┐ ┌──────────────┐  │    │
│  │  │poller.rs │ │nvml.rs   │ │process.rs    │  │    │
│  │  │fast/slow │─│GPU query │ │classify+enrich│  │    │
│  │  │loops     │ │via NVML  │ │via sysinfo   │  │    │
│  │  └────┬─────┘ └──────────┘ └──────────────┘  │    │
│  │       │                                       │    │
│  │  ┌────┴──────────────────┐                    │    │
│  │  │ app_handle.emit()     │                    │    │
│  │  │ pushes GpuSnapshot    │                    │    │
│  │  └───────────────────────┘                    │    │
│  │                                               │    │
│  │  ┌───────────────────────┐                    │    │
│  │  │ NVML (nvml.dll)       │                    │    │
│  │  │ loaded via libloading │                    │    │
│  │  └───────────────────────┘                    │    │
│  │                         ┌──────────────────┐  │    │
│  │                         │ MCP Server (v0.3)│  │    │
│  │                         │ localhost only   │  │    │
│  │                         └──────────────────┘  │    │
│  └───────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 8.2 Tauri IPC Protocol

**No WebSocket, no network.** Communication between Rust backend and React frontend uses Tauri's native IPC.

**Backend → Frontend (push, real-time data):**

```rust
// In poller.rs — emits on every poll tick
app_handle.emit("gpu-snapshot", &snapshot)?;
app_handle.emit("gpu-error", &error_payload)?;
```

```typescript
// In use-gpu-listener.ts
import { listen } from '@tauri-apps/api/event';
listen<GpuSnapshot>('gpu-snapshot', (event) => {
  gpuStore.getState().pushSnapshot(event.payload);
});
```

**Frontend → Backend (pull, on-demand):**

```typescript
// In use-device-info.ts
import { invoke } from '@tauri-apps/api/core';
const info = await invoke<DeviceInfo>('get_device_info');
await invoke('set_polling_interval', { intervalMs: 500 });
```

```rust
// In commands.rs
#[tauri::command]
fn get_device_info(state: State<AppState>) -> Result<DeviceInfo, String> { ... }

#[tauri::command]
fn set_polling_interval(state: State<AppState>, interval_ms: u64) -> Result<(), String> { ... }
```

### 8.3 Tiered Polling Architecture

| Tier | Interval | Data | Rationale |
|------|----------|------|-----------|
| Fast | 1000ms | GPU util, VRAM used/free, temp, power, clocks | Core metrics, change rapidly |
| Medium | 2000ms | Per-process VRAM breakdown (NVML + sysinfo) | Process enumeration is expensive (~5-10ms) |
| Slow | 5000ms | Fan speed, PCIe info | Rarely changes |
| Once | Startup | GPU name, driver version, VRAM total, CUDA cores | Static data |

Implemented as two tokio intervals in `poller.rs`. Fast loop runs every 1s. On every 2nd tick, it also runs process enrichment. On every 5th tick, it also runs supplementary metrics. Merged into a single `GpuSnapshot` before emitting.

### 8.4 Error Handling

| Error | Backend Behavior | Frontend Behavior |
|-------|-----------------|-------------------|
| NVML DLL not found | Emit `gpu-error` event, don't start poller | "NVIDIA drivers not installed" + download link |
| No GPU detected | Emit `gpu-error` event | "No NVIDIA GPU found" |
| Driver too old | Emit `gpu-error` event | "Driver version X required, you have Y" |
| NVML call fails mid-run | Log via tracing, set field to None, add to `errors` vec, continue polling | Show last known value with "stale" indicator |
| Process AccessDenied | Set command_line/exe_path to None, classify via other rules | Process shows without path info, still classified |
| Frontend crash | Backend continues polling (same process) | Tauri restarts WebView automatically |

### 8.5 Build Pipeline (GitHub Actions)

```yaml
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: cargo tauri build
      - uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: |
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
```

Must run on `windows-latest` — Rust backend links against Windows APIs and NVML.

---

## 9. Design Principles

### 9.1 Visual Design (from DESIGN.md)

- **Dark-first.** Dark theme is default. Neon-Max is the high-energy variant. No light theme — the "Kinetic Darkroom" aesthetic doesn't support one.
- **"Pools of light, not boxes."** Data and interactive elements are the light sources. Separation via tonal shifts, not borders (the "No-Line Rule").
- **Monospace for numbers.** All metric values use Space Grotesk so digits don't shift on rapid updates.
- **Neon glow for active states.** Focused inputs, toggled buttons, and active nav items use `box-shadow: 0 0 15px rgba(0, 255, 102, 0.4)`.
- **No pure white.** Text color is `#e5e1e4` to reduce eye fatigue.

### 9.2 Interaction Design

- **Zero onboarding.** App is immediately useful on first launch. Auto-detect GPU, auto-start sidecar, auto-display data.
- **Hover for detail, click for action.** Dashboard shows summaries. Hover shows tooltips. Click navigates to detail screens.
- **Profile switching is instant.** Toggling between Gaming and AI monitoring profiles reshuffles the dashboard in <200ms.

### 9.3 Product Design

- **Read-only through v0.3.** Pulse observes and informs. It never modifies GPU settings until v1.0.
- **Offline-only.** No accounts, no cloud, no telemetry. Everything local.
- **Portable.** Works from a USB stick. No registry dependencies.

---

## 10. Release Plan

### v0.1 — "See Everything" (MVP)

**Scope:** FR-1 through FR-5 (Dashboard, AI Workload, Settings, System Tray, GPU Info)
**Target:** 4–6 weeks
**Screens:** 3 (Dashboard, AI Workload, Settings) + Compact Overlay
**Deliverables:** Working Electron app, Windows installer on GitHub Releases, README with screenshots, docs (PRD, DESIGN.md, ARCHITECTURE.md, ROADMAP.md, CONTRIBUTING.md)
**Launch:** GitHub release → r/LocalLLaMA, r/pcgaming, r/nvidia, Hacker News (Show HN)

### v0.2 — "Understand Everything"

**Scope:** FR-6 through FR-10 (Gaming Profile, Session Recording, Session Replay with Ghost Delta, Hardware Analytics, PresentMon)
**Target:** 4–6 weeks after v0.1
**Screens:** +2 (Gaming Profile, Analytics)

### v0.3 — "Connect Everything"

**Scope:** FR-11 through FR-14 (Smart Profiles, VRAM Planner, MCP Server, Notifications)
**Target:** 6–8 weeks after v0.2

### v1.0 — "Control Everything"

**Scope:** Hardware tuning (fan curves, clock offsets, power limits), plugin API, multi-GPU, overlay, community benchmark database
**Target:** 3–4 months after v0.3
**Note:** This is the first version that writes to GPU hardware. Requires extensive testing, warning dialogs, and safe-default enforcement.

---

## 11. Success Metrics

### Product Metrics

| Metric | v0.1 (3 months) | v0.2 (6 months) |
|--------|-----------------|-----------------|
| GitHub stars | 200+ | 500+ |
| Downloads | 500+ | 2,000+ |
| External contributors | 3+ | 10+ |
| Issues filed | 20+ | 50+ |

### Portfolio Metrics

| Metric | Target |
|--------|--------|
| Referenced in TPM interviews | 2+ |
| Can defend every ADR under questioning | Yes |
| 60-second "why I built this" answer | Compelling |

### Quality Metrics

| Metric | Target |
|--------|--------|
| Crash rate | <1% of sessions |
| Data accuracy vs nvidia-smi | Within 1% |
| Time to first data | <3 seconds |

---

## 12. Open Questions

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | AMD GPU support? | Decided: No for v0.1–v1.0 | NVIDIA-only. Community plugin in v1.0+ |
| 2 | Sidecar as Windows service? | Deferred to v0.3 | Adds complexity and permissions |
| 3 | PresentMon in v0.1? | Decided: Defer to v0.2 | Keeps MVP tight |
| 4 | WebSocket port? | Decided: 9746 | Configurable |
| 5 | Settings format? | Decided: JSON | Human-readable, native to JS/TS |
| 6 | Auto-update mechanism? | Decided: Tauri updater | Built-in plugin, checks GitHub Releases |
| 7 | REST API alongside WebSocket? | Deferred to v0.3 | Useful for MCP and CLI tools |
| 8 | Hardware tuning in v0.1? | Decided: No | Read-only through v0.3. Tuning is v1.0 |
| 9 | Game artwork from Steam API? | Open for v0.2 | Nice UX but adds network dependency |
| 10 | VRAM block map tooltip: show fragmentation? | Decided: Yes for v0.1 | Per Stitch feature enhancements doc |

---

## 13. Appendix

### A. Design System Reference

Full design system specification in `docs/DESIGN.md` ("The Kinetic Darkroom"). Includes color tokens, typography rules, elevation principles, component specs, and do's/don'ts.

Design tokens for implementation:
```css
:root {
  --color-primary: #00FF66;
  --color-background: #0A0A0C;
  --color-surface: #141519;
  --color-surface-elevate: #1D1E24;
  --color-text: #F3F4F6;
  --color-muted: #8B909A;
  --color-warning: #FF3366;
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Manrope', sans-serif;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-neon: 0 0 16px rgba(0, 255, 102, 0.15);
  --shadow-surface: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

### B. Market Research Reference

Full competitive analysis in `docs/pulse-market-user-research.md`.

### C. NVML API Reference

- Docs: https://docs.nvidia.com/deploy/nvml-api/
- Rust bindings: https://crates.io/crates/nvml-wrapper
- Windows DLL: `%ProgramW6432%\NVIDIA Corporation\NVSMI\nvml.dll`

### D. Stitch Design Assets

Original Stitch design files and screenshots stored in `docs/design/stitch/`. Includes HTML prototypes, PNG screenshots, feature enhancement specs, and the DESIGN.md system specification.
