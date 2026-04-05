# Pulse — Architecture Review

**Date:** April 2026
**Scope:** Full-stack review covering framework choice, sidecar design, data pipeline, frontend state, packaging, and risk analysis.
**Input documents:** PRD v1.1, CLAUDE.md v1.1, DESIGN.md, market research, Stitch design exports.

---

## 1. Framework Decision: Electron vs Tauri

This is the most consequential architectural decision for the project. The PRD currently specifies Electron 29. After reviewing current benchmarks and production case studies, I'm recommending you **seriously consider Tauri 2 instead**.

### The case for switching to Tauri

**Resource overhead matters for a GPU monitoring tool.** Electron bundles Chromium + Node.js, consuming 150–300MB of RAM at idle. For a tool whose users will run it *alongside* demanding games and AI models competing for system resources, that overhead is a liability. Tauri uses the OS native WebView2 (which Windows 11 ships with), consuming 30–50MB idle. That's a 3–6x reduction in baseline memory.

**Bundle size.** A minimal Electron app is ~200MB. A Tauri app is ~3–10MB. For an open-source tool where downloads from GitHub Releases are the distribution channel, a 10MB installer versus a 200MB installer is a meaningful difference in adoption friction.

**Rust is already in the stack.** The sidecar is Rust. With Tauri, the "sidecar" becomes the backend — the NVML polling code lives directly in Tauri's Rust core via `#[tauri::command]` functions, eliminating the WebSocket layer entirely. Data flows from NVML → Rust → IPC → WebView with one fewer hop and one fewer process to manage.

**Sidecar lifecycle management.** Electron requires manual `child_process.spawn()` with custom health monitoring, restart logic, and zombie process cleanup. Tauri has a built-in Sidecar API that handles lifecycle management. Though in the Tauri case, the NVML code lives in the Rust backend directly, so there's no sidecar at all.

**Security posture.** Tauri's permission model is deny-by-default. Electron's is permissive by default and requires explicit lockdown (contextIsolation, nodeIntegration: false, sandbox, CSP). For a tool reading GPU hardware state, Tauri's model is more appropriate.

### The case for keeping Electron

**Stack consistency with Neon Protocol IDE.** Both projects on the same framework means shared knowledge, shared tooling configs, and portfolio coherence. If an interviewer asks about your Electron expertise, two projects demonstrate it better than one.

**Ecosystem maturity.** Electron is 10+ years old with battle-tested packaging (electron-builder), auto-updates (electron-updater), and thousands of solved edge cases on StackOverflow. Tauri 2 is production-ready but younger.

**WebView2 rendering differences.** Tauri on Windows uses WebView2 (Edge/Chromium), which is fine. But if you ever port to Linux, WebKitGTK has rendering quirks. Since Pulse is Windows-only, this is a non-issue.

**Your existing Next.js workflow.** The Junie → Claude Code CLI pipeline you've built is optimised for Next.js + Electron projects. Switching to Tauri changes the backend from Node.js to Rust, which means the architecture split is different. That said, Tauri's frontend stays React/Next.js, so the UI code is identical.

### Recommendation

**Switch to Tauri 2.** The performance argument is compelling for a GPU monitoring tool specifically. Your users care about resource efficiency — they'll notice if your monitoring app eats 300MB of RAM that could be serving their game or AI model. The Rust backend also eliminates the WebSocket middle layer, simplifying the architecture significantly.

The portfolio argument actually favours Tauri: showing Electron on Neon Protocol IDE *and* Tauri on Pulse demonstrates framework range rather than framework lock-in. At JetBrains or FAANG, the ability to evaluate and choose the right tool for the job is more impressive than consistency for consistency's sake.

**If you decide to keep Electron:** the rest of this review still applies. The sidecar architecture, data types, and frontend patterns work with either framework. The only changes are in the IPC layer (WebSocket vs Tauri commands) and the packaging pipeline.

---

## 2. Sidecar / Backend Architecture

### 2.1 If Tauri: Embedded Rust Backend

NVML polling code lives directly in the Tauri Rust backend. No separate process, no WebSocket.

```
src-tauri/
├── src/
│   ├── main.rs          # Tauri entry point
│   ├── nvml.rs          # NVML wrapper (same as before)
│   ├── process.rs       # Process detection + classification
│   ├── types.rs         # GpuSnapshot, ProcessInfo
│   ├── poller.rs        # Async polling loop (tokio interval)
│   ├── commands.rs      # #[tauri::command] functions exposed to frontend
│   └── state.rs         # Tauri managed state (latest snapshot, config)
├── Cargo.toml
└── tauri.conf.json
```

Data flow becomes: NVML → `poller.rs` (tokio interval) → Tauri managed state → `commands.rs` (frontend invokes) → React.

For real-time push (rather than pull), use Tauri's event system: `app_handle.emit("gpu-snapshot", &snapshot)`. The frontend listens via `listen("gpu-snapshot", callback)`. This is functionally equivalent to the WebSocket push model but with zero network overhead.

### 2.2 If Electron: Rust Sidecar (current PRD design)

The sidecar architecture as specified is sound, with a few adjustments needed.

**NVML initialisation.** The `nvml-wrapper` crate uses `libloading` to dynamically load `nvml.dll` at runtime. This means the sidecar binary works on systems without NVIDIA GPUs — it just returns an error. This is the correct behaviour. Key implementation detail: call `Nvml::init()` once at startup and store the instance in a `once_cell::sync::Lazy<Nvml>` or similar. Never reinitialise NVML per-poll — it reloads all function symbols each time.

**Process information enrichment.** NVML's `device.running_compute_processes()` and `device.running_graphics_processes()` return PIDs and VRAM usage, but not process names or command lines. You need Windows APIs (`QueryFullProcessImageNameW`, `NtQueryInformationProcess`, or the `sysinfo` crate) to resolve PID → name, path, and command line. The `sysinfo` crate is the pragmatic choice — it's cross-platform (though we only need Windows) and handles process enumeration cleanly.

**WebSocket implementation.** `tokio-tungstenite` is the right choice. Bind to `127.0.0.1:9746` — never `0.0.0.0`. The sidecar should accept only one WebSocket client at a time (the Electron renderer). If a second client connects, reject it.

**Sidecar health monitoring.** The Electron main process spawns the sidecar via `child_process.spawn()` and must monitor its health. Implement a heartbeat: the sidecar sends a `{"type": "heartbeat"}` message every 5 seconds. If the renderer doesn't receive a heartbeat for 15 seconds, show a "Sidecar unresponsive" warning. If the sidecar process exits, attempt restart (max 3 times with exponential backoff: 1s, 3s, 9s).

### 2.3 Polling Architecture (applies to both)

**Default interval: 1000ms.** This balances data freshness with CPU overhead. NVML calls are fast (~0.1ms each), but process enumeration via `sysinfo` is more expensive (~5–10ms for full refresh).

**Optimisation: split polling frequencies.** Not all data changes at the same rate.

| Data | Polling Frequency | Rationale |
|------|-------------------|-----------|
| GPU utilization, VRAM used/free, temperature, power, clocks | Every 1000ms | Core metrics, change rapidly |
| Per-process VRAM breakdown | Every 2000ms | Process list changes less frequently, enumeration is expensive |
| Fan speed, PCIe info | Every 5000ms | Changes rarely, mostly static |
| GPU name, driver version, VRAM total | Once at startup | Static data |

This tiered polling reduces CPU overhead by ~40% compared to polling everything at 1s.

**Implementation:** Use two tokio intervals — a fast loop (1s) for core metrics and a slow loop (5s) for supplementary data. Merge results into a single `GpuSnapshot` before pushing to the frontend.

---

## 3. Data Pipeline & Type Safety

### 3.1 The GpuSnapshot Contract

The type contract between Rust and TypeScript is solid as specified. Two additions needed:

**Add a `poll_generation` counter** (u64, incrementing) to every snapshot. This lets the frontend detect if it missed snapshots (gap in sequence) and handle accordingly (interpolate charts or show a gap).

**Add an `errors` field** (Vec<String>) for partial failures. If NVML fails to read fan speed but temperature succeeds, the snapshot should still be sent with the successful data plus an error entry for the failed call. The frontend can show stale data with a warning indicator rather than dropping the entire snapshot.

Updated type:

```rust
pub struct GpuSnapshot {
    pub poll_generation: u64,
    pub timestamp_ms: u64,
    pub gpu_utilization: u8,
    pub memory_utilization: u8,
    pub vram_total_mb: u32,
    pub vram_used_mb: u32,
    pub vram_free_mb: u32,
    pub temperature_c: u32,
    pub temperature_hotspot_c: Option<u32>,
    pub fan_speed_pct: Option<u32>,
    pub fan_speed_rpm: Option<u32>,
    pub power_draw_w: f32,
    pub power_limit_w: f32,
    pub clock_graphics_mhz: u32,
    pub clock_memory_mhz: u32,
    pub pcie_link_gen: Option<u8>,
    pub pcie_link_width: Option<u8>,
    pub processes: Vec<ProcessInfo>,
    pub errors: Vec<String>,
}
```

Note the `Option<>` wrappers on fields that some GPUs or driver versions don't support. The original type had these as non-optional, which would cause panics on hardware that doesn't report hotspot temperature or RPM.

### 3.2 Frontend State (Zustand)

The Zustand store architecture is correct. One refinement: **use a ring buffer for historical data, not an unbounded array.**

```typescript
// Circular buffer implementation
const BUFFER_SIZE = 300; // 5 minutes at 1s polling

interface GpuStore {
  current: GpuSnapshot | null;
  history: GpuSnapshot[];  // Ring buffer, max BUFFER_SIZE
  historyIndex: number;    // Write pointer
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  errors: string[];
  
  pushSnapshot: (snapshot: GpuSnapshot) => void;
  getHistorySlice: (seconds: number) => GpuSnapshot[];
}
```

The `pushSnapshot` action writes to `history[historyIndex % BUFFER_SIZE]` and increments the index. The `getHistorySlice` function returns the last N entries in chronological order. This avoids array growth, splice operations, and GC pressure from creating new arrays every second.

### 3.3 Process Classification Accuracy

The classification rules in the CLAUDE.md are a good starting point but need a priority system to handle ambiguity.

**Classification priority (highest wins):**

1. **User-defined overrides** (from Settings). If the user explicitly tags a process name, that wins.
2. **Exact executable name match** against known AI tools (ollama, lm-studio, comfyui, etc.)
3. **Path-based game detection** (Steam/Epic/GOG library paths)
4. **Command-line keyword match** (torch, cuda, transformers, diffusers)
5. **VRAM heuristic** (>500MB, not matching patterns 1–4) → "game"
6. **Default** → "system" for known Windows processes (dwm.exe, csrss.exe), "unknown" for everything else

**Critical implementation detail:** Command-line access requires `PROCESS_QUERY_INFORMATION` and `PROCESS_VM_READ` access rights on Windows. Some system processes and admin-level processes will deny access. Handle `AccessDenied` gracefully — classify as "system" and move on, don't crash.

---

## 4. Frontend Architecture

### 4.1 Rendering Performance

The dashboard updates every 1 second with new GPU data. React re-renders on every snapshot update. This is a potential performance issue if not handled correctly.

**Solution: selective subscriptions.** Zustand's `useStore` with a selector ensures components only re-render when their specific data changes.

```typescript
// Good: only re-renders when temperature changes
const temp = useGpuStore(s => s.current?.temperature_c);

// Bad: re-renders on every snapshot
const snapshot = useGpuStore(s => s.current);
```

The sparkline chart components should use `requestAnimationFrame` for smooth animation rather than re-rendering the entire SVG on every data point. Consider using a canvas-based chart library (like Chart.js with its canvas renderer) rather than SVG-based charts (like Recharts) for the Performance Stream timeline — canvas handles rapid updates more efficiently.

### 4.2 VRAM Block Map Rendering

The block map is the most complex UI component. With a 24GB GPU at 256MB per block, that's 96 blocks to render. Each block has a colour, a hover state, and a tooltip.

**Don't use individual React components per block.** 96 React component instances with hover state and event handlers is unnecessary overhead. Use a single `<canvas>` element with hit-testing for hover, or a single SVG with rects. Mouse position → block index via simple coordinate math.

### 4.3 Component Library Decision

The PRD references Tailwind for styling. For the specific design system ("Kinetic Darkroom" with custom tokens), you have two options:

**Option A: Pure Tailwind with custom config.** Map all design tokens into `tailwind.config.ts` under `theme.extend.colors`. Use utility classes throughout. Pros: consistent with your other projects, no additional dependency. Cons: complex components (the VRAM block map, the fan curve graph) will need custom CSS anyway.

**Option B: Tailwind + Radix UI primitives.** Use Radix for accessible, unstyled components (Slider, Toggle, Tooltip, Dialog) and Tailwind for all visual styling. Pros: accessibility handled correctly, keyboard navigation built-in. Cons: additional dependency.

**Recommendation: Option B.** The Settings screen has sliders, toggles, and text inputs. The VRAM block map needs tooltips. Building these from scratch is an accessibility risk and a time sink. Radix + Tailwind is a proven combination.

---

## 5. Packaging & Distribution

### 5.1 If Tauri

Tauri's built-in bundler produces:
- `.msi` installer (~5–10MB)
- `.exe` (NSIS installer)
- Portable `.exe`

The Rust binary is compiled for `x86_64-pc-windows-msvc`. NVML is loaded dynamically at runtime (not linked), so no NVIDIA SDK is needed at build time.

**Auto-updates:** Tauri 2 has a built-in updater plugin that checks GitHub Releases. This solves open question #6 from the PRD.

### 5.2 If Electron

electron-builder produces:
- `.exe` installer (NSIS, ~150–200MB)
- Portable `.exe`

The Rust sidecar must be compiled separately and bundled as an extra resource. electron-builder supports this via `extraResources` in the config. The sidecar binary goes to `resources/pulse-core.exe` and the Electron main process spawns it from there.

**Cross-compilation:** The GitHub Actions CI pipeline needs a Windows runner for the Rust sidecar build (cross-compiling Rust to Windows from Linux is possible but adds complexity with NVML linking).

### 5.3 Build Pipeline (GitHub Actions)

```yaml
# Simplified workflow
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable  # Rust
      - uses: actions/setup-node@v4           # Node.js
      - run: cd crates/pulse-core && cargo build --release
      - run: npm ci && npm run build
      - run: npm run package                   # or `cargo tauri build`
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*.exe
```

This must run on `windows-latest` because the Rust sidecar links against Windows APIs and NVML. Cross-compilation from Linux is not reliable for this stack.

---

## 6. Risk Register (Architecture-Specific)

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| 1 | NVML version mismatch: nvml-wrapper supports v12, user has older driver with v11 | Medium | Medium | Enable `legacy-functions` feature in nvml-wrapper. Test against driver versions 470, 535, 565, 570 |
| 2 | Process command-line access denied on protected processes | Low | High | Catch AccessDenied, classify as "system", log warning. Never crash on permission errors |
| 3 | WebView2 not installed on Windows 10 (Tauri-specific) | Medium | Low | Tauri's bootstrapper auto-installs WebView2. Add a pre-flight check with a friendly error message |
| 4 | Sysinfo crate CPU spike during process enumeration | Medium | Medium | Cache process list with 2s TTL. Only refresh process metadata when PID list changes |
| 5 | Electron memory overhead impacts gaming performance | High | High (if Electron) | This is the core argument for Tauri. If staying on Electron, implement aggressive renderer suspension when minimised |
| 6 | Circular buffer data loss during long sessions | Low | Low | 300 snapshots (5 min) is sufficient for live dashboard. Session recording (v0.2) writes to disk independently |
| 7 | Tauri learning curve delays MVP | Medium | Medium | Frontend code is identical to Electron. Only the IPC layer and build config change. Tauri docs are mature |
| 8 | GPU hotspot temperature not available on all models | Low | High | Field is `Option<u32>`. UI shows "N/A" gracefully |
| 9 | Multiple GPUs (SLI/NVLink or iGPU + dGPU) | Medium | Medium | v0.1: detect all GPUs, monitor only the first dGPU. Show "Multi-GPU support coming in v0.2" if multiple detected |
| 10 | DPI scaling breaks layout on 4K monitors | Medium | Medium | Test at 100%, 150%, 200% scaling. Tauri's WebView2 handles DPI natively. Electron requires explicit `BrowserWindow` config |

---

## 7. Architecture Decision Summary

| Decision | Recommendation | Confidence | Impact if wrong |
|----------|---------------|------------|-----------------|
| Tauri 2 over Electron | **Switch to Tauri** | High | Medium — frontend code is portable, only backend IPC changes |
| nvml-wrapper with serde + legacy-functions features | Keep as specified | High | Low |
| sysinfo crate for process enrichment | Add to stack | High | Low |
| Tiered polling (1s/2s/5s) | Adopt | High | Low — can simplify to single-interval if needed |
| Ring buffer for historical data | Adopt | High | Low |
| Option<> wrappers on hardware-variable fields | Adopt | Very high | High — without these, app crashes on some GPU models |
| Radix UI for accessible primitives | Adopt | Medium | Low — can swap to headless alternatives |
| Canvas for VRAM block map | Evaluate during build | Medium | Low — SVG works for 96 blocks, canvas is an optimisation |
| GitHub Actions on windows-latest | Required | Very high | Build fails without Windows runner |

---

## 8. Immediate Actions Before Scaffolding

1. **Decide Electron vs Tauri.** This gates everything else.
2. **Validate nvml-wrapper on your RTX 5070.** Write a 20-line Rust program that calls `Nvml::init()`, reads temperature, VRAM, and processes. Run it on your machine. This proves the data pipeline works before building any UI.
3. **Pick a project name on GitHub.** Check that `pulse-gpu` or similar is available as a GitHub repo name.
4. **Set up the repo with docs-first.** Push README, PRD, CLAUDE.md, DESIGN.md, ROADMAP, CONTRIBUTING *before* any code. This establishes the project as a serious, documented effort from commit #1.
