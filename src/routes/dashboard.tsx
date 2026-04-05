import { useGpuStore } from "../stores/gpu-store";
import { GpuHeroCard } from "../components/dashboard/gpu-hero-card";
import { MetricCards } from "../components/dashboard/metric-cards";
import { PerformanceTimeline } from "../components/dashboard/performance-timeline";
import { VramStackedBar } from "../components/vram/stacked-bar";
import { HeadroomIndicator } from "../components/headroom/headroom-indicator";
import { ErrorState } from "../components/shared/error-state";

export function Dashboard() {
  const nvmlError = useGpuStore((s) => s.nvmlError);
  const hasCurrent = useGpuStore((s) => s.current !== null);

  if (nvmlError) {
    return (
      <ErrorState
        title="NVML Unavailable"
        message={nvmlError}
      />
    );
  }

  if (!hasCurrent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted font-body">Connecting to GPU...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 overflow-y-auto h-full">
      <GpuHeroCard />
      <HeadroomIndicator />
      <VramStackedBar />
      <MetricCards />
      <PerformanceTimeline />
    </div>
  );
}
