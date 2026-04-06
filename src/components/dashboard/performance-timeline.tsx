import { useGpuStore } from "../../stores/gpu-store";

export function PerformanceTimeline() {
  const history = useGpuStore((s) => s.history);
  const currentUtil = useGpuStore((s) => s.current?.gpu_utilization ?? 0);
  const points = history.getLastN(60);

  const width = 600;
  const height = 100;
  const barCount = 60;
  const barWidth = width / barCount - 1;

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-display text-muted uppercase tracking-wider">
            Performance Stream
          </h3>
          <span className="text-xs font-body text-muted">Last 60 Seconds Telemetry</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-sm text-on-surface">{currentUtil}%</span>
          <span className="text-xs font-display text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            LIVE
          </span>
        </div>
      </div>
      <div className="w-full overflow-hidden">
        {points.length === 0 ? (
          <div className="h-24 flex items-center justify-center">
            <span className="text-xs text-muted font-body">Waiting for data...</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            preserveAspectRatio="none"
          >
            {points.map((snap, i) => {
              const barHeight = (snap.gpu_utilization / 100) * height;
              const x = i * (width / barCount);
              const opacity = 0.4 + (snap.gpu_utilization / 100) * 0.6;
              return (
                <rect
                  key={i}
                  x={x}
                  y={height - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={1}
                  fill="#00FF66"
                  opacity={opacity}
                >
                  <title>{snap.gpu_utilization}% GPU</title>
                </rect>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
