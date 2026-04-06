import { useGpuStore } from "../stores/gpu-store";
import { useDeviceInfo } from "../hooks/use-device-info";
import { VramBlockMap } from "../components/vram/block-map";
import { ProcessTable } from "../components/vram/process-table";
import { ErrorState } from "../components/shared/error-state";

export function AiWorkload() {
  const nvmlError = useGpuStore((s) => s.nvmlError);
  const hasCurrent = useGpuStore((s) => s.current !== null);
  const powerDraw = useGpuStore((s) => s.current?.power_draw_w ?? 0);
  const powerLimit = useGpuStore((s) => s.current?.power_limit_w ?? 0);
  const { deviceInfo } = useDeviceInfo();

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
      <h1 className="font-display text-xl text-on-surface tracking-tight">
        AI Workload Monitor
      </h1>

      {/* CUDA Detection Banner */}
      <CudaBanner cudaVersion={deviceInfo?.cuda_version ?? null} />

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
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{
              width: `${powerLimit > 0 ? Math.min((powerDraw / powerLimit) * 100, 100) : 0}%`,
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
          <span className="text-xs font-display text-muted">N/A</span>
        </div>
        <div className="py-6 text-center text-sm text-muted font-body">
          Tensor core utilization data is not exposed by consumer NVML drivers
        </div>
      </div>
    </div>
  );
}

function CudaBanner({ cudaVersion }: { cudaVersion: string | null }) {
  if (cudaVersion) {
    return (
      <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="font-display text-sm text-primary">
          CUDA {cudaVersion} Detected
        </span>
        <span className="text-xs text-muted font-body">
          — AI workloads are GPU-accelerated
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-lg px-4 py-3">
      <span className="w-2 h-2 rounded-full bg-warning" />
      <span className="font-display text-sm text-warning">
        CUDA Not Detected
      </span>
      <span className="text-xs text-muted font-body">
        — AI workloads may not be GPU-accelerated
      </span>
    </div>
  );
}
