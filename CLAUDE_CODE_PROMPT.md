# Claude Code Scaffolding Prompt for Pulse
# ==========================================
# 
# HOW TO USE:
# 1. Place all project docs in C:\Users\mulli\projects\pulse\ first
# 2. Open PowerShell, cd to the project directory
# 3. Run: claude
# 4. Paste the prompt below
#
# The CLAUDE.md in the project root will be automatically loaded.
# This prompt handles the initial scaffolding only.

--- PASTE BELOW THIS LINE ---

Read the CLAUDE.md, docs/PRD.md, docs/DESIGN.md, and ROADMAP.md in this project. Then scaffold the full Pulse project in this directory.

Step 1 — Initialise Tauri 2 with React + TypeScript template. Use npm as package manager. App name: "pulse", window title: "Pulse".

Step 2 — Install frontend dependencies: zustand, immer, @radix-ui/react-slider, @radix-ui/react-toggle, @radix-ui/react-tooltip, @radix-ui/react-dialog, chart.js, react-chartjs-2.

Step 3 — Add these crate dependencies to src-tauri/Cargo.toml:
- nvml-wrapper with features ["serde", "legacy-functions"]
- sysinfo
- tokio with features ["full"]
- serde with features ["derive"]
- serde_json
- tracing
- tracing-subscriber
- once_cell

Step 4 — Create the Rust backend module structure in src-tauri/src/:
- main.rs (thin Tauri entry point)
- nvml.rs (NVML wrapper — init once via once_cell, all GPU queries here)
- process.rs (process detection + classification using the priority chain from CLAUDE.md)
- types.rs (GpuSnapshot, ProcessInfo, DeviceInfo — exact fields from CLAUDE.md type contract)
- poller.rs (tiered async polling: fast 1s, medium 2s, slow 5s, with app_handle.emit)
- commands.rs (#[tauri::command] functions: get_device_info, set_polling_interval, get_current_snapshot)
- state.rs (AppState struct with Nvml instance, current snapshot, config)
- classify.rs (classification priority chain logic)

Step 5 — Create the frontend structure in src/:
- App.tsx (three-column shell layout: LeftNav + main content + QuickTune sidebar)
- routes/dashboard.tsx, routes/ai-workload.tsx, routes/settings.tsx
- components/shell/left-nav.tsx, header.tsx, quick-tune.tsx
- components/dashboard/ (placeholder components for GPU hero card, metric cards)
- components/vram/stacked-bar.tsx, block-map.tsx, process-table.tsx
- components/headroom/headroom-indicator.tsx
- stores/gpu-store.ts (with ring buffer, pushSnapshot, getHistorySlice)
- stores/profile-store.ts (gaming/ai monitoring profile presets)
- stores/ui-store.ts (theme, sidebar collapsed state)
- hooks/use-gpu-listener.ts (Tauri event listener for gpu-snapshot)
- hooks/use-device-info.ts (invoke get_device_info on mount)
- lib/types.ts (TypeScript types matching Rust types.rs exactly)
- lib/ring-buffer.ts (fixed-size circular buffer, BUFFER_SIZE=300)
- lib/constants.ts (color tokens, temperature thresholds, known AI process names)

Step 6 — Configure Tailwind with the design system tokens from docs/DESIGN.md:
- Colors: primary #00FF66, background #0A0A0C, surface #141519, surface-elevate #1D1E24, text #F3F4F6, muted #8B909A, warning #FF3366
- Fonts: Space Grotesk (display/headline/label), Manrope (body)
- Border radii: sm 8px, md 12px, lg 16px

Step 7 — Set up a basic working data flow: Rust backend initialises NVML, starts the fast polling loop, emits gpu-snapshot events. Frontend listens, pushes to Zustand store, dashboard displays the current GPU utilization and VRAM usage. If NVML is unavailable, show a clear error state.

Step 8 — Verify the app runs with `npm run dev`. Confirm the three-column layout renders and GPU data flows from backend to frontend.

Do NOT implement the full UI design yet — this is scaffolding only. Use placeholder components with the correct data bindings. The visual polish comes in a follow-up session using the Stitch designs in docs/design/stitch/.

After scaffolding, list what was created and confirm the data flow works.
