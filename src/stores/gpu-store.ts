import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { GpuSnapshot } from "../lib/types";
import { RingBuffer, BUFFER_SIZE } from "../lib/ring-buffer";

interface GpuState {
  current: GpuSnapshot | null;
  history: RingBuffer<GpuSnapshot>;
  nvmlError: string | null;
  pushSnapshot: (snapshot: GpuSnapshot) => void;
  setNvmlError: (error: string) => void;
  getHistorySlice: (n: number) => GpuSnapshot[];
}

export const useGpuStore = create<GpuState>()(
  immer((set, get) => ({
    current: null,
    history: new RingBuffer<GpuSnapshot>(BUFFER_SIZE),
    nvmlError: null,

    pushSnapshot: (snapshot: GpuSnapshot) => {
      set((state) => {
        state.current = snapshot;
        state.history.push(snapshot);
      });
    },

    setNvmlError: (error: string) => {
      set((state) => {
        state.nvmlError = error;
      });
    },

    getHistorySlice: (n: number) => {
      return get().history.getLastN(n);
    },
  }))
);
