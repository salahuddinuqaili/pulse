import { create } from "zustand";

import type { MonitoringProfile, ProcessInfo, ProfileMode } from "../lib/types";

interface ProfileState {
  activeProfile: MonitoringProfile;
  setProfile: (profile: MonitoringProfile) => void;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  activeProfile: "gaming",
  setProfile: (profile) => set({ activeProfile: profile }),
}));

/**
 * Auto-detect the active profile mode from a process list. Mirrors the
 * Rust ProfileMode::detect logic so the UI can pre-select the relevant
 * recommendations view without an extra IPC round trip.
 */
export function detectProfileMode(processes: ProcessInfo[] | undefined): ProfileMode {
  if (!processes || processes.length === 0) return "idle";
  const hasGame = processes.some((p) => p.category === "game");
  const hasAi = processes.some((p) => p.category === "ai");
  if (hasGame && hasAi) return "gaming+ai";
  if (hasGame) return "gaming";
  if (hasAi) return "ai";
  return "idle";
}
