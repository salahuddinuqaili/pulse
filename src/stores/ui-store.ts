import { create } from "zustand";

interface UiState {
  leftNavExpanded: boolean;
  rightSidebarExpanded: boolean;
  toggleLeftNav: () => void;
  toggleRightSidebar: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  leftNavExpanded: false,
  rightSidebarExpanded: true,

  toggleLeftNav: () =>
    set((state) => ({ leftNavExpanded: !state.leftNavExpanded })),

  toggleRightSidebar: () =>
    set((state) => ({ rightSidebarExpanded: !state.rightSidebarExpanded })),
}));
