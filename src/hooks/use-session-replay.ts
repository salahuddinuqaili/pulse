import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GpuSnapshot } from "../lib/types";

export interface ReplayState {
  session: GpuSnapshot[];
  ghostSession: GpuSnapshot[] | null;
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  isLoading: boolean;
  error: string | null;
}

export function useSessionReplay() {
  const [state, setState] = useState<ReplayState>({
    session: [],
    ghostSession: null,
    currentIndex: 0,
    isPlaying: false,
    playbackSpeed: 1,
    isLoading: false,
    error: null,
  });

  const timerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const loadSession = useCallback(
    async (sessionId: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const snapshots = await invoke<GpuSnapshot[]>("load_session", {
          sessionId,
        });
        setState((s) => ({
          ...s,
          session: snapshots,
          currentIndex: 0,
          isPlaying: false,
          isLoading: false,
        }));
        stopPlayback();
      } catch (e) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: String(e),
        }));
      }
    },
    [stopPlayback]
  );

  const loadGhost = useCallback(async (sessionId: string) => {
    try {
      const snapshots = await invoke<GpuSnapshot[]>("load_session", {
        sessionId,
      });
      setState((s) => ({ ...s, ghostSession: snapshots }));
    } catch (e) {
      console.error("Failed to load ghost session:", e);
    }
  }, []);

  const clearGhost = useCallback(() => {
    setState((s) => ({ ...s, ghostSession: null }));
  }, []);

  const seekTo = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      currentIndex: Math.max(0, Math.min(index, s.session.length - 1)),
    }));
  }, []);

  const startPlayback = useCallback(() => {
    stopPlayback();
    setState((s) => ({ ...s, isPlaying: true }));

    timerRef.current = window.setInterval(() => {
      const current = stateRef.current;
      if (current.currentIndex >= current.session.length - 1) {
        stopPlayback();
        return;
      }
      setState((s) => ({ ...s, currentIndex: s.currentIndex + 1 }));
    }, 1000 / stateRef.current.playbackSpeed);
  }, [stopPlayback]);

  const togglePlayback = useCallback(() => {
    if (stateRef.current.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [startPlayback, stopPlayback]);

  const setPlaybackSpeed = useCallback(
    (speed: number) => {
      setState((s) => ({ ...s, playbackSpeed: speed }));
      if (stateRef.current.isPlaying) {
        stopPlayback();
        // Restart at new speed after state update
        setTimeout(() => startPlayback(), 0);
      }
    },
    [startPlayback, stopPlayback]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const currentSnapshot =
    state.session.length > 0 ? state.session[state.currentIndex] : null;
  const ghostSnapshot =
    state.ghostSession && state.ghostSession.length > state.currentIndex
      ? state.ghostSession[state.currentIndex]
      : null;

  return {
    ...state,
    currentSnapshot,
    ghostSnapshot,
    loadSession,
    loadGhost,
    clearGhost,
    seekTo,
    togglePlayback,
    startPlayback,
    stopPlayback,
    setPlaybackSpeed,
  };
}
