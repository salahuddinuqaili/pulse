import { useGpuStore } from "../../stores/gpu-store";
import { useDeviceInfo } from "../../hooks/use-device-info";
import { getTemperatureColor } from "../../lib/constants";

export function GpuHeroCard() {
  const gpuUtil = useGpuStore((s) => s.current?.gpu_utilization ?? 0);
  const vramUsed = useGpuStore((s) => s.current?.vram_used_mb ?? 0);
  const vramTotal = useGpuStore((s) => s.current?.vram_total_mb ?? 0);
  const tempC = useGpuStore((s) => s.current?.temperature_c ?? 0);
  const powerDraw = useGpuStore((s) => s.current?.power_draw_w ?? 0);
  const powerLimit = useGpuStore((s) => s.current?.power_limit_w ?? 0);
  const clockGraphics = useGpuStore((s) => s.current?.clock_graphics_mhz ?? 0);
  const fanSpeed = useGpuStore((s) => s.current?.fan_speed_pct);
  const { deviceInfo } = useDeviceInfo();

  const vramUsedGb = (vramUsed / 1024).toFixed(1);
  const vramTotalGb = (vramTotal / 1024).toFixed(1);
  const vramPct = vramTotal > 0 ? (vramUsed / vramTotal) * 100 : 0;

  return (
    <div className="bg-surface-elevate rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-on-surface tracking-tight">
          {deviceInfo?.name ?? "Detecting GPU..."}
        </h2>
        {deviceInfo?.driver_version && (
          <span className="text-xs text-muted font-display">
            Driver {deviceInfo.driver_version}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* VRAM Ring */}
        <div className="flex flex-col items-center">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50" cy="50" r="42"
                fill="none" stroke="#1D1E24" strokeWidth="8"
              />
              <circle
                cx="50" cy="50" r="42"
                fill="none" stroke="#00FF66" strokeWidth="8"
                strokeDasharray={`${vramPct * 2.64} ${264 - vramPct * 2.64}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-lg text-on-surface">{vramUsedGb}</span>
              <span className="font-display text-xs text-muted">/ {vramTotalGb} GB</span>
            </div>
          </div>
          <span className="text-xs text-muted font-display mt-2">VRAM</span>
        </div>

        {/* Temperature */}
        <MetricCard
          label="Temperature"
          value={`${tempC}`}
          unit="°C"
          color={getTemperatureColor(tempC)}
        />

        {/* GPU Utilization */}
        <MetricCard label="GPU Load" value={`${gpuUtil}`} unit="%" color="#00FF66" />

        {/* Clock Speed */}
        <MetricCard label="Core Clock" value={`${clockGraphics}`} unit="MHz" color="#00FF66" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-surface-highest/20">
        {/* Power */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted font-display">Power Draw</span>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-on-surface">{powerDraw.toFixed(0)}</span>
            <span className="text-xs text-muted font-display">/ {powerLimit.toFixed(0)} W</span>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full mt-1">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${powerLimit > 0 ? (powerDraw / powerLimit) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Fan Speed */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted font-display">Fan Speed</span>
          <span className="font-display text-on-surface">
            {fanSpeed != null ? `${fanSpeed}%` : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-3xl" style={{ color }}>
        {value}
      </span>
      <span className="text-xs text-muted font-display">{unit}</span>
      <span className="text-xs text-muted font-display mt-1">{label}</span>
    </div>
  );
}
