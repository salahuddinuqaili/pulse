import { useGpuStore } from "../../stores/gpu-store";

export function FanCurve() {
  const fanSpeed = useGpuStore((s) => s.current?.fan_speed_pct ?? null);
  const temperature = useGpuStore((s) => s.current?.temperature_c ?? 0);
  const history = useGpuStore((s) => s.getHistorySlice(60));

  // Build scatter points from recent history
  const points = history
    .filter((s) => s.fan_speed_pct != null)
    .map((s) => ({
      temp: s.temperature_c,
      fan: s.fan_speed_pct!,
    }));

  const currentPoint = fanSpeed !== null ? { temp: temperature, fan: fanSpeed } : null;

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider">
          Fan Curve
        </h3>
        {fanSpeed !== null && (
          <span className="font-display text-sm text-on-surface">
            {fanSpeed}% @ {temperature}&deg;C
          </span>
        )}
      </div>

      {/* Simple SVG scatter plot */}
      <svg
        viewBox="0 0 300 150"
        className="w-full"
        style={{ maxHeight: 150 }}
      >
        {/* Grid lines */}
        {[25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1={30}
            y1={140 - pct * 1.3}
            x2={290}
            y2={140 - pct * 1.3}
            stroke="rgba(139, 144, 154, 0.1)"
            strokeWidth={1}
          />
        ))}

        {/* Axis labels */}
        <text x={0} y={145} fill="#8B909A" fontSize={9} fontFamily="Space Grotesk">
          0%
        </text>
        <text x={0} y={15} fill="#8B909A" fontSize={9} fontFamily="Space Grotesk">
          100%
        </text>
        <text x={30} y={148} fill="#8B909A" fontSize={8} fontFamily="Space Grotesk">
          30&deg;C
        </text>
        <text x={260} y={148} fill="#8B909A" fontSize={8} fontFamily="Space Grotesk">
          90&deg;C
        </text>

        {/* History points */}
        {points.map((p, i) => {
          const x = 30 + ((p.temp - 30) / 60) * 260;
          const y = 140 - p.fan * 1.3;
          return (
            <circle
              key={i}
              cx={Math.max(30, Math.min(290, x))}
              cy={Math.max(10, Math.min(140, y))}
              r={2}
              fill="#8B909A"
              opacity={0.3}
            />
          );
        })}

        {/* Current operating point */}
        {currentPoint && (
          <>
            <circle
              cx={Math.max(30, Math.min(290, 30 + ((currentPoint.temp - 30) / 60) * 260))}
              cy={Math.max(10, Math.min(140, 140 - currentPoint.fan * 1.3))}
              r={5}
              fill="#00FF66"
              stroke="#00FF66"
              strokeWidth={2}
              opacity={0.8}
            />
            <circle
              cx={Math.max(30, Math.min(290, 30 + ((currentPoint.temp - 30) / 60) * 260))}
              cy={Math.max(10, Math.min(140, 140 - currentPoint.fan * 1.3))}
              r={10}
              fill="none"
              stroke="#00FF66"
              strokeWidth={1}
              opacity={0.3}
            />
          </>
        )}
      </svg>

      {fanSpeed === null && (
        <p className="text-center text-sm text-muted font-body mt-2">
          Fan speed data unavailable
        </p>
      )}
    </div>
  );
}
