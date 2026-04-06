import { useGpuStore } from "../stores/gpu-store";
import { ErrorState } from "../components/shared/error-state";
import { GameHero } from "../components/gaming/game-hero";
import { FpsCounter } from "../components/gaming/fps-counter";
import { FrameTimeChart } from "../components/gaming/frame-time-chart";
import { FrameDistribution } from "../components/gaming/frame-distribution";
import { FanCurve } from "../components/gaming/fan-curve";

export function GamingProfile() {
  const nvmlError = useGpuStore((s) => s.nvmlError);
  const hasCurrent = useGpuStore((s) => s.current !== null);

  if (nvmlError) {
    return <ErrorState title="NVML Unavailable" message={nvmlError} />;
  }

  if (!hasCurrent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted font-body">Waiting for GPU data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 overflow-y-auto h-full">
      <GameHero />
      <FpsCounter />
      <FrameTimeChart />
      <FrameDistribution />
      <FanCurve />
    </div>
  );
}
