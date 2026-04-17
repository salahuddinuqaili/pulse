import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

import type { MonitoringProfile, ProcessInfo, ProfileMode } from "../lib/types";

interface ProfileState {
  activeProfile: MonitoringProfile;
  setProfile: (profile: MonitoringProfile) => void;
  loadProfile: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  activeProfile: "gaming",
  setProfile: (profile) => {
    set({ activeProfile: profile });
    // Persist to settings
    invoke("get_settings")
      .then((s: unknown) =>
        invoke("save_settings", { settings: { ...(s as Record<string, unknown>), active_profile: profile } })
      )
      .catch((e) => console.error("Failed to persist profile:", e));
  },
  loadProfile: async () => {
    try {
      const s = await invoke<{ active_profile?: string }>("get_settings");
      if (s.active_profile === "gaming" || s.active_profile === "ai") {
        set({ activeProfile: s.active_profile });
      }
    } catch {
      // keep default
    }
  },
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
