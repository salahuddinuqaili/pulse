# Contributing to Pulse

Thanks for your interest in contributing to Pulse. This document covers how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/pulse.git`
3. Install prerequisites:
   - [Rust](https://rustup.rs/) (stable toolchain)
   - [Node.js 20+](https://nodejs.org/)
   - NVIDIA GPU with driver 470+ (for testing)
4. Install dependencies: `npm install`
5. Run in dev mode: `npm run dev`

## Development Workflow

- Create a feature branch: `git checkout -b feat/your-feature`
- Make your changes
- Run tests: `npm test` and `cd src-tauri && cargo test`
- Commit with conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Open a pull request against `main`

## Architecture

Before contributing, please read:
- `CLAUDE.md` — project architecture, stack, conventions, type contracts
- `docs/PRD.md` — product requirements and feature scope
- `docs/DESIGN.md` — visual design system ("The Kinetic Darkroom")

## Key Conventions

**Rust backend (src-tauri/src/):**
- All NVML calls go through `nvml.rs` — never call nvml-wrapper directly from other modules
- Use `Result<T, E>` everywhere — no `.unwrap()` in production code
- Use `tracing` for logging, not `println!`

**TypeScript frontend (src/):**
- Strict mode, no `any`
- Zustand stores: one file per store, subscribe to specific slices via selectors
- Tailwind CSS only — no CSS-in-JS

**The type contract between `src-tauri/src/types.rs` and `src/lib/types.ts` must stay in sync.** If you change a field in either file, update both.

## What to Contribute

Check the [issues](../../issues) for tasks labelled `good first issue` or `help wanted`. High-impact areas:
- Adding process names to the AI/game classification lists
- Improving VRAM headroom guidance text
- Testing on different GPU models and driver versions
- UI polish and accessibility improvements

## Code of Conduct

Be respectful, constructive, and patient. We're building something useful together.
