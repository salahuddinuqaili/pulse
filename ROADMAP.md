# Pulse — Roadmap

## v0.1 — "See Everything" (MVP)

**Target:** 4–6 weeks from development start

**Screens:** Dashboard, AI Workload, Settings + Compact Overlay

**Core deliverables:**
- Tauri 2 desktop app with Rust backend polling NVML
- Real-time GPU dashboard (utilization, VRAM, temp, power, clocks)
- VRAM Process Map with AI/game/system classification
- VRAM Block Map (canvas-based, per-process tooltips)
- Headroom Indicator with contextual guidance
- Monitoring profiles (Gaming View / AI View display presets — no hardware writes)
- System tray mode with compact overlay
- Settings (theme, polling interval, thresholds, custom process classification)
- Windows installer (.msi) via Tauri bundler

**Launch:** GitHub Releases → r/LocalLLaMA, r/pcgaming, r/nvidia, Hacker News (Show HN)

---

## v0.2 — "Understand Everything"

**Target:** 4–6 weeks after v0.1

**New screens:** Gaming Profile, Hardware Analytics

**Core deliverables:**
- Gaming Profile screen with game detection and per-game VRAM tracking
- PresentMon integration for frame-time data (FPS, 1% low, 0.1% low)
- Session recording (GPU metrics + VRAM per-process as gzipped JSONL)
- Session replay with timeline scrubbing
- Ghost Delta comparison (live vs recorded baseline with delta indicators)
- Hardware Analytics with historical charting (1D/1W/1M)
- Export sessions as PNG snapshots or markdown summaries

---

## v0.3 — "Connect Everything"

**Target:** 6–8 weeks after v0.2

**Core deliverables:**
- Smart workload profiles with actionable recommendations
- VRAM Budget Planner ("If I load model X at quantization Y, I'll have Z GB left")
- MCP Server integration (local AI tools can query GPU state programmatically)
- Notification system (VRAM threshold, thermal throttle, process events)
- Plugin API groundwork

---

## v0.4 — "Harden Everything"

**Target:** 2–3 weeks after v0.3
**Spec:** `docs/specs/PHASE-0.4-SPEC.md`
**Threat model:** `SECURITY.md`

Security hardening pass after a review found 6 high/medium findings in v0.3. Fixes the foundation before v1.0 adds hardware writes on top.

**Core deliverables:**
- Strip command-line collection (default OFF) — closes credential leak via MCP and session recordings
- Move Stream Deck/OBS secrets from plaintext `settings.json` into Windows Credential Manager
- DNS rebinding protection on the MCP server (Host header allowlist) + Tauri capability scoping
- Hardware-write privilege model: detect non-admin, "Restart as administrator" UX (privilege-separated helper process committed for v1.1)
- `IntegrityFile<T>` HMAC-SHA256 primitive (used by v1.0's `restore.json`), `cargo-audit` and `npm audit` gates in CI

---

## v1.0 — "Control Everything"

**Target:** 3–4 months after v0.4

**Core deliverables:**
- Hardware tuning (fan curves, clock offsets, power limits) — first version with GPU write operations
- Full plugin API with documentation
- Multi-GPU support
- In-game overlay
- Community benchmark database
- Extensive safety guards and warning dialogs for all write operations
