import { useEffect, useState } from "react";
import { useSessionStore } from "../../stores/session-store";
import { useGpuStore } from "../../stores/gpu-store";
import { useDeviceInfo } from "../../hooks/use-device-info";

export function SessionControls() {
  const isRecording = useSessionStore((s) => s.isRecording);
  const recordingStartMs = useSessionStore((s) => s.recordingStartMs);
  const recordingMode = useSessionStore((s) => s.recordingMode);
  const startRecording = useSessionStore((s) => s.startRecording);
  const stopRecording = useSessionStore((s) => s.stopRecording);
  const setRecordingMode = useSessionStore((s) => s.setRecordingMode);

  const { deviceInfo } = useDeviceInfo();
  const gameProcess = useGpuStore((s) =>
    s.current?.processes.find((p) => p.category === "game") ?? null
  );

  const [elapsed, setElapsed] = useState("00:00");

  // Update elapsed timer
  useEffect(() => {
    if (!isRecording || !recordingStartMs) return;

    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - recordingStartMs) / 1000);
      const min = String(Math.floor(seconds / 60)).padStart(2, "0");
      const sec = String(seconds % 60).padStart(2, "0");
      setElapsed(`${min}:${sec}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording, recordingStartMs]);

  const handleStart = () => {
    const gpuName = deviceInfo?.name ?? "Unknown GPU";
    const gameName = gameProcess?.name.replace(/\.exe$/i, "") ?? null;
    startRecording(gpuName, gameName).catch(console.error);
  };

  const handleStop = () => {
    stopRecording().catch(console.error);
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          <span className="text-xs font-display text-warning">{elapsed}</span>
        </span>
        <button
          onClick={handleStop}
          className="text-xs font-display text-warning hover:text-on-surface transition-colors px-2 py-1 rounded hover:bg-surface-elevate"
        >
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={recordingMode}
        onChange={(e) =>
          setRecordingMode(e.target.value as "standard" | "high-fidelity")
        }
        className="text-xs font-display text-muted bg-surface-elevate rounded px-2 py-1 outline-none"
      >
        <option value="standard">1s</option>
        <option value="high-fidelity">100ms</option>
      </select>
      <button
        onClick={handleStart}
        className="flex items-center gap-1.5 text-xs font-display text-muted hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-elevate"
      >
        <svg
          width={10}
          height={10}
          viewBox="0 0 10 10"
          fill="currentColor"
        >
          <circle cx="5" cy="5" r="5" />
        </svg>
        Record
      </button>
    </div>
  );
}
