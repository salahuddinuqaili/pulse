import { useGpuStore } from "../../stores/gpu-store";

/** Sparkline-style timeline showing last 60 seconds of GPU utilization.
 *  Placeholder — will use Chart.js canvas in design pass. */
export function PerformanceTimeline() {
  const history = useGpuStore((s) => s.history);
  const points = history.getLastN(60);

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider">
          Performance Stream
        </h3>
        <span className="text-xs font-display text-primary">LIVE</span>
      </div>
      <div className="h-20 flex items-end gap-px">
        {points.length === 0 ? (
          <span className="text-xs text-muted font-body m-auto">
            Waiting for data...
          </span>
        ) : (
          points.map((snap, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/60 rounded-t transition-all"
              style={{ height: `${snap.gpu_utilization}%` }}
              title={`${snap.gpu_utilization}% GPU`}
            />
          ))
        )}
      </div>
    </div>
  );
}
