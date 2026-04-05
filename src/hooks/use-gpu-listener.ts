import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import type { GpuSnapshot } from "../lib/types";
import { useGpuStore } from "../stores/gpu-store";

/** Listens for gpu-snapshot events from the Rust backend and pushes them into the store. */
export function useGpuListener() {
  const pushSnapshot = useGpuStore((s) => s.pushSnapshot);
  const setNvmlError = useGpuStore((s) => s.setNvmlError);

  useEffect(() => {
    const unlistenSnapshot = listen<GpuSnapshot>("gpu-snapshot", (event) => {
      pushSnapshot(event.payload);
    });

    const unlistenError = listen<string>("gpu-error", (event) => {
      setNvmlError(event.payload);
    });

    return () => {
      unlistenSnapshot.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [pushSnapshot, setNvmlError]);
}
