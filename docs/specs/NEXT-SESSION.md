# Next Session: PHASE-0.3 Implementation

## Current State

**PHASE-0.1 is complete and released as v0.1.0.**
**PHASE-0.2 is complete — all 6 deliverables merged to main (PRs #13–#18).**
**PHASE-0.3 decisions are made and SPEC is written.**

## What to do

Start a fresh session. Read `docs/specs/PHASE-0.3-SPEC.md` and implement deliverables in order (D1 through D5). Each deliverable gets its own branch (`feat/phase-0.3-*`) and PR to main.

## Implementation Spec

**`docs/specs/PHASE-0.3-SPEC.md`** — Full implementation spec with:
- File-by-file instructions for all 5 deliverables
- Notification threshold logic and cooldown system
- Model VRAM database (TypeScript constant, no backend dep)
- Recommendations engine design (Rust, profile-aware)
- MCP server protocol (JSON-RPC 2.0 over HTTP + SSE via axum)
- MCP resource URIs (gpu://status, gpu://vram/*, gpu://temperature, gpu://headroom)
- Settings integrations UI (MCP toggle + placeholders for Stream Deck / OBS)
- Test plans per deliverable
- Pre-push checklist

## Key Decisions (to be logged in CLAUDE.md)

1. **axum HTTP + SSE for MCP** — Custom MCP protocol implementation on localhost. Rust MCP SDK crate rejected (immature ecosystem). axum + tokio already in dep tree.
2. **tauri-plugin-notification** — Official Tauri plugin for Windows toast notifications. No custom Win32 code needed.
3. **TypeScript model database** — Static `MODEL_DATABASE` constant in `src/lib/model-database.ts`. VRAM planner is a pure frontend calculator. serde_yaml rejected (unnecessary backend dependency).

## Deliverable Order

1. D1: Notification System (lowest risk — Tauri plugin, threshold checks)
2. D2: VRAM Budget Planner (medium risk — new route, frontend-only calculator)
3. D3: Smart Workload Profiles (medium risk — Rust recommendations engine)
4. D4: MCP Server (highest risk — new protocol, axum HTTP server)
5. D5: Settings — External Integrations (low risk — UI, depends on D1+D4)

## Environment

- Windows 11, RTX 5070 (12GB VRAM)
- Rust 1.94.1 stable (MSVC), Node 20, npm
- NVML available, CUDA available
