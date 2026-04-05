# Pulse

**See what your GPU is doing. Know what it can still do.**

Pulse is an open-source GPU performance monitor built for the dual-use era — where gaming GPUs also run local AI. It's the first tool that treats gaming and AI workloads as first-class citizens in the same dashboard.

## Why Pulse?

If you run Ollama alongside Steam games on the same NVIDIA GPU, you know the pain: alt-tab to Afterburner for thermals, check nvidia-smi for VRAM, guess whether your 7B model will fit alongside Cyberpunk. Pulse answers the question no other tool can: **"What can my GPU do right now?"**

- **VRAM Process Map** — see exactly which process owns which VRAM, color-coded by workload type (AI, game, system)
- **Headroom Indicator** — "4.7 GB available — room for a 7B Q4 model alongside your game"
- **VRAM Block Map** — visual grid showing memory allocation across your entire VRAM pool
- **Monitoring Profiles** — switch between Gaming and AI views instantly
- **Lightweight** — ~30MB RAM, ~10MB installer. Built with Tauri 2 + Rust, not Electron

## Screenshots

*Coming soon — currently in design phase with [Stitch](docs/design/stitch/) prototypes*

## Tech Stack

- **Tauri 2** — Rust backend + native WebView2
- **Rust** — NVML polling, process detection, hardware queries
- **React 19 + TypeScript** — frontend UI
- **Tailwind CSS** — styling ("The Kinetic Darkroom" design system)
- **Zustand** — state management with ring buffer for real-time data

## Requirements

- Windows 10/11 (64-bit)
- NVIDIA GPU with driver 470+
- WebView2 runtime (ships with Windows 11, auto-installs on Windows 10)

## Installation

*Pre-built installers will be available on [GitHub Releases](../../releases) once v0.1 ships.*

### Build from Source

```bash
# Prerequisites: Rust (stable), Node.js 20+
git clone https://github.com/YOUR_USERNAME/pulse.git
cd pulse
npm install
npm run dev        # Dev mode with hot reload
cargo tauri build  # Production build
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full plan.

| Version | Status | Focus |
|---------|--------|-------|
| v0.1 | In development | Dashboard, AI Workload, Settings, Compact Overlay |
| v0.2 | Planned | Gaming Profile, Session Recording, Ghost Delta, PresentMon |
| v0.3 | Planned | MCP Server, Smart Profiles, VRAM Budget Planner |
| v1.0 | Planned | Hardware tuning, Plugin API, Multi-GPU |

## Documentation

- [Product Requirements](docs/PRD.md) — what we're building and why
- [Design System](docs/DESIGN.md) — "The Kinetic Darkroom" visual language
- [Architecture Review](docs/architecture-review.md) — full technical analysis
- [Market Research](docs/market-research.md) — competitive landscape and user research
- [Contributing](CONTRIBUTING.md) — how to get involved

## License

MIT
