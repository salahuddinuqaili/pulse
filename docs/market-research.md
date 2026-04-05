# Pulse — Market & User Research Report

**Project:** Open-source GPU performance intelligence for gaming + AI workloads on Windows (NVIDIA)
**Date:** April 2026
**Purpose:** Inform product decisions, validate differentiation, and optimize for portfolio impact

---

## 1. Market Landscape

### 1.1 Target Market Size

The addressable market is large and growing. NVIDIA holds approximately 72–75% of GPU share among Steam's 132 million monthly active users (as of 2025–2026). The RTX 3060 and RTX 4060 remain the most popular GPUs on Steam, but the RTX 50 series (Blackwell) is gaining ground rapidly — the RTX 5070 alone jumped to ~3% share within months of launch. 16GB VRAM configurations are surging (+5.85% in January 2026 alone), reflecting both the new generation's baseline specs and growing user awareness of VRAM as a critical resource.

Crucially, the overlap between "gamers" and "local AI users" is no longer niche. Over 42% of developers now run LLMs locally, and the RTX 5070 (your card) sits squarely in the sweet spot — 12GB VRAM that can run quantized 14B–30B models while still being a gaming GPU. This dual-use audience is the core target.

### 1.2 Competitive Landscape

| Tool | Type | Strengths | Weaknesses | Status |
|------|------|-----------|------------|--------|
| **MSI Afterburner** | Closed-source, free | Most popular GPU tool. OC, monitoring, overlay via RTSS. Works on any GPU. | Turbulent development history (Ukraine/Russia payment crisis). Solo developer dependency. No AI workload awareness. Dated UI. | Active — v4.6.6 stable (Oct 2025), v4.6.7 beta (Feb 2026). MSI claims continued support but fragility persists. |
| **HWiNFO** | Freemium, closed-source | Deepest sensor coverage of any tool. Exports to Prometheus/Grafana. | Information overload — not designed for quick glances. No overlay without RTSS. No AI context. Pro features paywalled. | Active, well-maintained. |
| **GPU-Z** | Free, closed-source | Lightweight. Excellent for static GPU info and sensor monitoring. | Read-only. No overlay. No process-level VRAM. No AI awareness. | Active. |
| **NVIDIA FrameView** | Free, NVIDIA-only | Built on PresentMon. DLSS/frame generation aware. Power/performance measurement. | NVIDIA-controlled, limited to frame analysis. No system monitoring. No AI awareness. | Active. |
| **CapFrameX** | Open-source | PresentMon-based. Great frame-time analysis and session comparison. | Focused solely on frame-time capture/analysis. No live monitoring dashboard. | Active. |
| **PresentMon** | Open-source (Intel) | The foundation layer — most frame analysis tools build on it. Frame type differentiation for AI-generated frames (DLSS4). | Low-level; not user-friendly as a standalone tool. | Active, v2.x with GUI. |
| **nvitop / nvtop** | Open-source | Best process-level NVIDIA GPU monitoring. Python-based (nvitop) or C-based (nvtop). | TUI only — no GUI. Linux-first (nvitop works on Windows but is CLI). No gaming metrics. | Active. |
| **Open Hardware Monitor / Libre Hardware Monitor** | Open-source | Cross-vendor sensor reading. .NET-based. | Dated UI. No overlay. No AI/gaming context. No process VRAM. | Libre HW Monitor is active; OHM is stale. |
| **nvidia-smi** | NVIDIA CLI | Definitive NVML data — utilization, VRAM, processes, power, thermals. | CLI only. No historical view. No gaming context. | Bundled with drivers. |
| **Task Manager (Win 11)** | Built-in | Basic GPU utilization and per-process GPU usage. | Under-reports in some games. No VRAM per-process breakdown. No AI awareness. Driver-dependent inconsistency. | Ships with Windows. |

### 1.3 Key Market Gaps Identified

**Gap 1 — No unified gaming + AI monitoring tool exists.** Every tool above serves either gamers OR AI/ML users, never both. A user running Ollama + Cyberpunk 2077 on the same GPU currently needs nvidia-smi in one terminal and Afterburner's overlay simultaneously, with no tool understanding the relationship between the two workloads.

**Gap 2 — Process-level VRAM attribution is poorly surfaced.** nvidia-smi shows it in a CLI table. Task Manager shows approximate GPU memory per process. No tool translates this into an intuitive visual (e.g., "Ollama is using 4.2GB, your game is using 3.8GB, you have 4GB free").

**Gap 3 — "Can I run this alongside that?" is unanswered.** The most common VRAM question in forums is "if I have Ollama loaded with a 7B model, can I still game?" No tool provides a headroom indicator or workload compatibility estimate.

**Gap 4 — Session recording for dual workloads doesn't exist.** CapFrameX records frame-times; Afterburner can log sensor data. Neither records the full picture — GPU utilization, VRAM allocation per process, thermals, and frame-time together as a replayable timeline.

**Gap 5 — Afterburner's future remains structurally fragile.** Despite v4.6.6's release in Oct 2025, the project depends on a single developer (Alexey Nicolaychuk) whose relationship with MSI has been strained since 2022. The tool has had multi-year gaps between stable releases. An open-source alternative with community governance addresses a genuine long-term sustainability concern.

---

## 2. User Research

### 2.1 Target User Personas

**Persona 1: The Dual-Use Gamer (Primary)**
- Owns RTX 3060–5070 range (12–16GB VRAM)
- Runs Ollama/LM Studio alongside Steam games
- Pain: "I don't know if my VRAM can handle both at once"
- Behavior: Checks nvidia-smi in terminal, alt-tabs to Afterburner, frustrated by the split
- Wants: One glanceable dashboard that shows the whole picture

**Persona 2: The Performance Optimizer**
- Enthusiast who benchmarks every game
- Currently uses Afterburner + CapFrameX + HWiNFO
- Pain: "I have three tools open and still can't see the full picture"
- Behavior: Exports CSVs, compares sessions, posts on r/pcgaming
- Wants: Unified session recording with export/comparison

**Persona 3: The Local AI Builder**
- Runs multiple models, ComfyUI, or training workloads
- Checks nvidia-smi obsessively
- Pain: "I need to know VRAM per model, not just total. And when my model spills to RAM, I want to see it immediately"
- Behavior: Uses nvitop or custom scripts
- Wants: A GUI version of nvitop with historical data

**Persona 4: The Curious Newcomer**
- Just bought first gaming PC, maybe trying local AI for the first time
- Pain: "I don't understand what any of these numbers mean"
- Behavior: Googles "is my GPU temperature too high"
- Wants: Clear, contextual guidance — not raw numbers

### 2.2 User Pain Points (from forums, Reddit, HN)

**VRAM is the #1 concern across both audiences.** Forum discussions consistently collapse into "VRAM math" — users manually calculating whether a quantized model will fit alongside a game. Common frustrations include crashes from VRAM exhaustion with no warning, slow performance when models silently spill to system RAM, and inability to see per-process VRAM in a meaningful way.

**Tool fragmentation is a consistent complaint.** Users regularly describe running 3–4 tools simultaneously. The typical gaming stack is Afterburner + RTSS (overlay) + HWiNFO (detailed sensors) + CapFrameX (frame analysis). Adding AI monitoring means nvidia-smi or nvitop on top. No one enjoys this.

**Afterburner trust is eroding.** While still the default, users are aware of its development instability. The 2022–2023 "probably dead" episode, combined with multi-year gaps between stable releases, has created latent demand for an alternative. The phishing/fake download site problem (MSI itself warns about it) further undermines trust.

**Newcomers are overwhelmed.** Most monitoring tools present raw numbers without context. A GPU at 78°C — is that bad? VRAM at 85% usage — should I worry? This contextual interpretation layer is absent from every tool on the market.

### 2.3 User Needs Matrix

| Need | Priority | Addressed by competitors? |
|------|----------|--------------------------|
| Real-time GPU vitals (temp, clocks, utilization, power) | Must-have | Yes — well served |
| Per-process VRAM breakdown with AI/game labeling | Must-have | Partially (nvidia-smi CLI only) |
| VRAM headroom indicator ("can I launch X?") | Must-have | No |
| Frame-time overlay | Should-have | Yes (RTSS, PresentMon) |
| Session recording & replay | Should-have | Partially (CapFrameX for frames only) |
| Workload profiles (gaming-only, gaming+AI, AI-only) | Nice-to-have | No |
| Thermal context ("is this temp safe?") | Nice-to-have | No |
| Export/share reports | Nice-to-have | Partially (CapFrameX) |

---

## 3. Technical Feasibility

### 3.1 Data Sources

**NVIDIA NVML (primary).** The NVML library is the definitive API for NVIDIA GPU monitoring. It provides GPU utilization, VRAM usage (total/used/free), temperature, fan speed, power draw, clock speeds, and per-process compute/graphics memory usage. NVML is thread-safe, ships with NVIDIA drivers, and is available on Windows at `%ProgramW6432%\NVIDIA Corporation\NVSMI\`. The Rust ecosystem has the `nvml-wrapper` crate (last updated Feb 2026, 890+ GitHub stars) which provides safe Rust bindings.

**Key NVML capabilities for Pulse:**
- `nvmlDeviceGetUtilizationRates` — GPU and memory controller utilization
- `nvmlDeviceGetMemoryInfo_v2` — total/used/free VRAM (v2 includes reserved memory)
- `nvmlDeviceGetComputeRunningProcesses` / `nvmlDeviceGetGraphicsRunningProcesses` — per-process VRAM
- `nvmlDeviceGetTemperature` — core and (some cards) hotspot temp
- `nvmlDeviceGetPowerUsage` — real-time power in milliwatts
- `nvmlDeviceGetClockInfo` — graphics and memory clocks

**PresentMon SDK (frame analysis).** PresentMon is Intel's open-source frame capture library, the foundation under FrameView, CapFrameX, and OCAT. It now supports frame type differentiation (distinguishing native vs. DLSS-generated frames). Integration would provide frame-time data without reinventing the wheel. Licensed under MIT.

**Windows Performance Counters (supplementary).** For CPU, RAM, disk, and network metrics to provide system-level context alongside GPU data.

### 3.2 Architecture Recommendation

**Rust sidecar + Electron frontend (via WebSocket)**

The Rust sidecar handles all hardware polling via NVML at configurable intervals (default 1s, high-fidelity mode at 100ms for session recording). It runs as a lightweight background process, communicating with the Electron UI over a local WebSocket. This architecture means the monitoring overhead is minimal — Rust's zero-cost abstractions and NVML's thread-safety make this a clean fit. The sidecar also handles process identification (mapping PIDs to process names and categorizing them as "game," "AI/ML," or "system").

The frontend uses the existing Neon Protocol stack: Next.js 14 + React 19 + TypeScript + Tailwind + Zustand. This consistency across your portfolio is itself a signal — interviewers see architectural coherence, not just individual projects.

### 3.3 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| NVML API changes with driver updates | Medium | Pin minimum driver version, test against beta drivers, abstract NVML calls behind versioned interface |
| PresentMon integration complexity on Windows | Medium | Start without frame-time overlay; add as v0.2 feature. Use PresentMon's service mode |
| Electron resource overhead while gaming | High | Minimize rendering when minimized. Sidecar continues collecting; UI is lazy. Offer "lightweight mode" that hides UI and exposes tray icon only |
| Process identification accuracy | Low | Use Windows API `QueryFullProcessImageName` + heuristic matching for known AI runtimes (ollama.exe, python.exe with torch, comfyui, etc.) |

---

## 4. Product Strategy

### 4.1 Positioning Statement

**Pulse is the first open-source GPU monitor designed for the dual-use era — where gaming GPUs also run local AI. It answers the question existing tools can't: "What can my GPU do right now?"**

### 4.2 MVP Scope (v0.1)

The MVP should be demonstrably useful in under 5 minutes of installation and clearly differentiated from Afterburner within 30 seconds of opening.

**Core features:**
1. **GPU Dashboard** — Real-time vitals: utilization, VRAM, temperature, power, clocks. Clean, modern UI.
2. **VRAM Process Map** — Visual breakdown of VRAM by process, with automatic classification: "Game" (green), "AI/ML" (purple), "System" (gray). Shows Ollama, LM Studio, ComfyUI, Python+CUDA processes distinctly.
3. **Headroom Indicator** — A single, prominent metric: "X GB available" with contextual guidance ("Enough for a 7B Q4 model" or "Your game may need to reduce textures").
4. **System tray mode** — Minimize to tray with key metrics visible on hover.

**Explicitly out of scope for v0.1:** Overlay, frame-time analysis, session recording, overclocking, fan curves, workload profiles. These are v0.2+ features.

### 4.3 Differentiation Map

| Feature | Afterburner | HWiNFO | GPU-Z | nvidia-smi | **Pulse** |
|---------|-------------|--------|-------|------------|-----------|
| GPU vitals | ✓ | ✓ | ✓ | ✓ | ✓ |
| Per-process VRAM | ✗ | ✗ | ✗ | ✓ (CLI) | ✓ (GUI, labeled) |
| AI process detection | ✗ | ✗ | ✗ | ✗ | ✓ |
| VRAM headroom estimate | ✗ | ✗ | ✗ | ✗ | ✓ |
| Workload classification | ✗ | ✗ | ✗ | ✗ | ✓ |
| Modern UI | ✗ | ✗ | ✗ | ✗ | ✓ |
| Open source | ✗ | ✗ | ✗ | ✗ | ✓ |
| Frame-time overlay | ✓ (via RTSS) | ✗ | ✗ | ✗ | v0.2 |

### 4.4 Roadmap

**v0.1 — "See Everything" (MVP)**
- GPU dashboard + VRAM process map + headroom indicator
- System tray mode
- Windows installer
- Target: Ship within 4–6 weeks

**v0.2 — "Understand Everything"**
- Session recording (GPU metrics + VRAM per-process over time)
- Session replay with annotated timeline ("Ollama loaded at 3:42, game launched at 3:45")
- PresentMon integration for frame-time data
- Export session as PNG summary or JSON

**v0.3 — "Optimize Everything"**
- Workload profiles with recommendations
- VRAM budget planner ("If you load Qwen 14B Q4, you'll have X GB left for gaming")
- Plugin API for community extensions
- Notification system ("VRAM > 90%", "GPU thermal throttling")

**v1.0 — "Community-Driven"**
- Plugin marketplace
- Community benchmark database
- Multi-GPU support
- Overlay (via custom lightweight renderer, not RTSS dependency)

---

## 5. Portfolio Optimization

### 5.1 How This Strengthens the TPM Narrative

Pulse fills a specific gap in your portfolio. Neon Protocol IDE demonstrates architectural ambition and technical breadth. Skillich demonstrates product thinking and taxonomy design. Pulse demonstrates something different: the ability to identify a real market gap, validate it through research, scope an MVP ruthlessly, and ship a working product that real users want.

For JetBrains, FAANG, and senior IC roles, interviewers look for three things:

1. **Systems thinking** — Pulse's architecture (Rust sidecar + Electron + NVML + WebSocket) shows you understand performance constraints, process isolation, and why monitoring software must be lightweight. The ADR documentation makes the reasoning explicit.

2. **Product instinct** — The dual-use gaming/AI insight isn't obvious. Most GPU tools serve one audience. Identifying and serving the intersection demonstrates market awareness that most engineers lack.

3. **Shipping discipline** — A tight v0.1 with clear documentation ships faster and communicates more than an ambitious v0.5 that never lands. The roadmap structure (v0.1 → v0.2 → v0.3) shows prioritization skill.

### 5.2 Repository Structure for Maximum Impact

```
pulse/
├── README.md                    # Hero README with screenshots, one-liner, badges
├── PRODUCT_SPEC.md              # Problem, users, scope, success metrics
├── ROADMAP.md                   # Tiered roadmap with rationale
├── CONTRIBUTING.md              # How to contribute, code of conduct
├── ARCHITECTURE.md              # System diagram, data flow, component roles
├── docs/
│   ├── adr/                     # Architecture Decision Records
│   │   ├── 001-rust-sidecar.md  # Why Rust over Node/Python for polling
│   │   ├── 002-nvml-over-wmi.md # Why NVML vs Windows WMI counters
│   │   ├── 003-websocket-ipc.md # Why WebSocket vs Electron IPC
│   │   └── 004-process-detection.md # AI process heuristics
│   ├── user-research/           # This research document
│   └── design/                  # Stitch exports, wireframes
├── crates/
│   └── pulse-core/              # Rust sidecar (NVML polling, process detection)
├── src/                         # Next.js + React frontend
├── electron/                    # Electron main process
└── .github/
    └── workflows/               # CI/CD via GitHub Actions
```

### 5.3 Success Metrics

| Metric | Target (3 months post-launch) | Why it matters |
|--------|-------------------------------|----------------|
| GitHub stars | 200+ | Social proof for portfolio |
| Downloads | 500+ | Validates real demand |
| Contributors | 3+ (beyond you) | Shows community viability |
| Issue engagement | 20+ issues filed by users | Shows people care enough to report |
| Interview mentions | Referenced in 2+ TPM interviews | The actual goal |

---

## 6. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| NVIDIA changes NVML API | Product breaks | Low | Version-pinned NVML interface, CI testing against new drivers |
| Afterburner ships AI features | Differentiation narrows | Low | Afterburner's codebase and development model make rapid pivots unlikely |
| NVIDIA releases own unified tool | Existential | Medium | Open source + community = moat. NVIDIA tools are always NVIDIA-only and closed |
| Scope creep (overlay, OC, etc.) | Delays MVP | High | Tier 1/2/3 discipline. v0.1 ships with 4 features only |
| Electron overhead impacts gaming | User complaints | Medium | Lightweight mode, tray-only option, sidecar runs independently |
| Project competes with your other projects for time | Nothing ships | High | Timebox: 4–6 weeks to v0.1. Use Claude Code CLI workflow. If Stitch designs are ready, code follows fast |

---

## 7. Immediate Next Steps

1. **Finalize Stitch designs** for the three core screens (dashboard, VRAM map, settings)
2. **Scaffold the repo** with documentation-first approach (README, PRODUCT_SPEC, ARCHITECTURE, ROADMAP)
3. **Prototype the Rust sidecar** — get NVML polling working and outputting JSON over WebSocket
4. **Build the dashboard** — connect React frontend to live sidecar data
5. **Ship v0.1** with Windows installer via GitHub Releases

---

*This research was conducted to inform the design of Pulse, an open-source GPU performance intelligence tool. All market data sourced from public Steam Hardware Surveys, NVIDIA documentation, community forums, and published articles as of April 2026.*
