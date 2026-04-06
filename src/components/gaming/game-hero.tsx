import { useGpuStore } from "../../stores/gpu-store";

export function GameHero() {
  const processes = useGpuStore((s) => s.current?.processes ?? []);
  const gameProcess = processes.find((p) => p.category === "game");

  if (!gameProcess) {
    return (
      <div className="bg-surface-elevate rounded-xl p-8 text-center">
        <div className="text-2xl font-display text-muted mb-2">No game running</div>
        <p className="text-sm text-muted font-body">
          Start a game to see FPS data and frame-time analysis
        </p>
      </div>
    );
  }

  const gameName = gameProcess.name
    .replace(/\.exe$/i, "")
    .replace(/[_-]/g, " ");

  return (
    <div className="relative bg-surface-elevate rounded-xl p-6 overflow-hidden">
      {/* Gradient glow background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
          <h1 className="font-display text-2xl text-on-surface tracking-tight capitalize">
            {gameName}
          </h1>
        </div>
        <p className="text-xs text-muted font-body mt-1">
          PID {gameProcess.pid} &middot; {gameProcess.vram_mb} MB VRAM
        </p>
      </div>
    </div>
  );
}
