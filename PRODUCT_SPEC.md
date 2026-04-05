# Pulse — Product Spec

## What

Open-source desktop app that monitors NVIDIA GPU performance for users who game and run local AI on the same hardware.

## For Whom

Power users with RTX 3060–5090 GPUs who run Ollama, LM Studio, or ComfyUI alongside Steam games and need to understand VRAM allocation, thermal headroom, and workload balance without juggling 3–4 separate monitoring tools.

## Core Insight

Existing GPU tools serve gamers OR AI builders, never both. Pulse is the first monitor designed for dual-use, answering: **"What can my GPU do right now?"**

## MVP Scope (v0.1)

Three screens + compact overlay:

1. **Dashboard** — GPU vitals (utilization, VRAM ring, temp, clocks, power), VRAM stacked bar by process, headroom indicator, performance timeline
2. **AI Workload** — VRAM block map (canvas grid), active AI processes table, power draw meter, tensor core timeline, CUDA detection
3. **Settings** — theme (System/Dark/Neon-Max), polling intervals, temperature thresholds, custom process classification
4. **Compact Overlay** — minimal always-on-top window (FPS, temp, VRAM bar)

## Key Differentiators

| Feature | Afterburner | HWiNFO | nvidia-smi | **Pulse** |
|---------|-------------|--------|------------|-----------|
| Per-process VRAM (GUI) | No | No | CLI only | Yes |
| AI process detection | No | No | No | Yes |
| VRAM headroom estimate | No | No | No | Yes |
| Modern UI | No | No | No | Yes |
| Open source | No | No | No | Yes |
| <80MB RAM footprint | ~200MB+ | ~50MB | ~5MB | ~30MB |

## What Pulse Does NOT Do (v0.1)

- Write to GPU hardware (no overclocking, no fan curves, no power limits)
- Support AMD GPUs
- Require network access, accounts, or telemetry

## Success Metrics (3 months post-launch)

200+ GitHub stars, 500+ downloads, 3+ external contributors.

## Full Documentation

- [PRD](docs/PRD.md) — complete product requirements
- [Architecture Review](docs/architecture-review.md) — technical analysis
- [Market Research](docs/market-research.md) — competitive landscape
