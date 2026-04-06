import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

import type { SessionMetadata } from "../lib/types";

interface SessionState {
  isRecording: boolean;
  recordingStartMs: number | null;
  recordingMode: "standard" | "high-fidelity";
  sessions: SessionMetadata[];
  startRecording: (gpuName: string, gameDetected: string | null) => Promise<void>;
  stopRecording: () => Promise<void>;
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setRecordingMode: (mode: "standard" | "high-fidelity") => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  isRecording: false,
  recordingStartMs: null,
  recordingMode: "standard",
  sessions: [],

  startRecording: async (gpuName, gameDetected) => {
    const intervalMs = get().recordingMode === "standard" ? 1000 : 100;
    await invoke("start_recording", {
      intervalMs: intervalMs,
      gpuName: gpuName,
      gameDetected: gameDetected,
    });
    set({ isRecording: true, recordingStartMs: Date.now() });
  },

  stopRecording: async () => {
    await invoke("stop_recording");
    set({ isRecording: false, recordingStartMs: null });
    // Refresh session list
    get().loadSessions();
  },

  loadSessions: async () => {
    const sessions = await invoke<SessionMetadata[]>("list_sessions");
    set({ sessions });
  },

  deleteSession: async (id) => {
    await invoke("delete_session", { sessionId: id });
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    }));
  },

  setRecordingMode: (mode) => set({ recordingMode: mode }),
}));
