import { useGpuStore } from "../stores/gpu-store";
import { VramBlockMap } from "../components/vram/block-map";
import { ProcessTable } from "../components/vram/process-table";
import { ErrorState } from "../components/shared/error-state";

export function AiWorkload() {
  const nvmlError = useGpuStore((s) => s.nvmlError);
  const hasCurrent = useGpuStore((s) => s.current !== null);
  const powerDraw = useGpuStore((s) => s.current?.power_draw_w ?? 0);
  const powerLimit = useGpuStore((s) => s.current?.power_limit_w ?? 0);

  if (nvmlError) {
    return <ErrorState title="NVML Unavailable" message={nvmlError} />;
  }

  if (!hasCurrent) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted font-body">Waiting for GPU data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 overflow-y-auto h-full">
      <h1 className="font-display text-xl text-on-surface tracking-tight">
        AI Workload Monitor
      </h1>

      <VramBlockMap />
      <ProcessTable />

      {/* Power Draw Meter */}
      <div className="bg-surface-elevate rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-display text-muted uppercase tracking-wider">
            Power Draw
          </h3>
          <span className="font-display text-on-surface text-sm">
            {powerDraw.toFixed(0)}W / {powerLimit.toFixed(0)}W
          </span>
        </div>
        <div className="w-full h-3 bg-surface rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{
              width: `${powerLimit > 0 ? (powerDraw / powerLimit) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Tensor Core Load placeholder */}
      <div className="bg-surface-elevate rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-display text-muted uppercase tracking-wider">
            Tensor Core Load Timeline
          </h3>
          <span className="text-xs font-display text-primary">LIVE TRACE</span>
        </div>
        <div className="py-8 text-center text-sm text-muted font-body">
          Tensor data not available for this GPU/driver — requires specific NVML support
        </div>
      </div>
    </div>
  );
}
