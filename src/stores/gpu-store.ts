import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { GpuSnapshot } from "../lib/types";
import { RingBuffer, BUFFER_SIZE } from "../lib/ring-buffer";

export interface FrameTimeSample {
  timestamp: number;
  ms: number;
}

interface GpuState {
  current: GpuSnapshot | null;
  history: RingBuffer<GpuSnapshot>;
  frameTimeHistory: RingBuffer<FrameTimeSample>;
  nvmlError: string | null;
  pushSnapshot: (snapshot: GpuSnapshot) => void;
  setNvmlError: (error: string) => void;
  getHistorySlice: (n: number) => GpuSnapshot[];
  getFrameTimeSlice: (n: number) => FrameTimeSample[];
}

export const useGpuStore = create<GpuState>()(
  immer((set, get) => ({
    current: null,
    history: new RingBuffer<GpuSnapshot>(BUFFER_SIZE),
    frameTimeHistory: new RingBuffer<FrameTimeSample>(BUFFER_SIZE),
    nvmlError: null,

    pushSnapshot: (snapshot: GpuSnapshot) => {
      set((state) => {
        state.current = snapshot;
        state.history.push(snapshot);
        if (snapshot.frame_time_ms != null) {
          state.frameTimeHistory.push({
            timestamp: snapshot.timestamp_ms,
            ms: snapshot.frame_time_ms,
          });
        }
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

    getFrameTimeSlice: (n: number) => {
      return get().frameTimeHistory.getLastN(n);
    },
  }))
);
