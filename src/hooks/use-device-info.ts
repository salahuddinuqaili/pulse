import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { DeviceInfo } from "../lib/types";

/** Fetches static device info once on mount via Tauri IPC. */
export function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<DeviceInfo>("get_device_info")
      .then((info) => {
        setDeviceInfo(info);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { deviceInfo, error, loading };
}
