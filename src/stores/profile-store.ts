import { create } from "zustand";

import type { MonitoringProfile } from "../lib/types";

interface ProfileState {
  activeProfile: MonitoringProfile;
  setProfile: (profile: MonitoringProfile) => void;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  activeProfile: "gaming",
  setProfile: (profile) => set({ activeProfile: profile }),
}));
