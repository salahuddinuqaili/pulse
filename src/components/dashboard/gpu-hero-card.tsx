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
  const circumference = 2 * Math.PI * 52;

  return (
    <div className="bg-surface-elevate rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-lg text-on-surface tracking-tight">
            {deviceInfo?.name ?? "Detecting GPU..."}
          </h2>
          {deviceInfo?.driver_version && (
            <span className="text-xs text-muted font-display">
              Driver {deviceInfo.driver_version}
            </span>
          )}
        </div>
        {deviceInfo?.cuda_cores && (
          <span className="text-xs text-muted font-display">
            {deviceInfo.cuda_cores.toLocaleString()} CUDA Cores
          </span>
        )}
      </div>

      <div className="flex items-center gap-8">
        {/* VRAM Ring — 120x120 per spec */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative" style={{ width: 120, height: 120 }}>
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60" cy="60" r="52"
                fill="none" stroke="#1D1E24" strokeWidth="8"
              />
              <circle
                cx="60" cy="60" r="52"
                fill="none" stroke="#00FF66" strokeWidth="8"
                strokeDasharray={`${(vramPct / 100) * circumference} ${circumference}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl text-on-surface">{vramUsedGb}</span>
              <span className="font-display text-xs text-muted">/ {vramTotalGb} GB</span>
            </div>
          </div>
          <span className="text-xs text-muted font-display mt-2 uppercase tracking-wider">VRAM Usage</span>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 flex-1">
          <HeroMetric
            label="Temperature"
            value={`${tempC}`}
            unit="°C"
            color={getTemperatureColor(tempC)}
          />
          <HeroMetric label="GPU Load" value={`${gpuUtil}`} unit="%" color="#00FF66" />
          <HeroMetric label="Core Clock" value={`${clockGraphics}`} unit="MHz" color="#00FF66" />
          <HeroMetric
            label="Fan Speed"
            value={fanSpeed != null ? `${fanSpeed}` : "N/A"}
            unit={fanSpeed != null ? "%" : ""}
            color="#e5e1e4"
          />
        </div>
      </div>

      {/* Power bar */}
      <div className="mt-5 pt-4 border-t border-surface-highest/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted font-display uppercase tracking-wider">Power Draw</span>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-on-surface">{powerDraw.toFixed(0)}</span>
            <span className="text-xs text-muted font-display">/ {powerLimit.toFixed(0)} W</span>
          </div>
        </div>
        <div className="w-full h-2 bg-surface rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${powerLimit > 0 ? Math.min((powerDraw / powerLimit) * 100, 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
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
    <div className="flex flex-col">
      <span className="text-xs text-muted font-display uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="font-display text-2xl" style={{ color }}>{value}</span>
        <span className="text-sm text-muted font-display">{unit}</span>
      </div>
    </div>
  );
}
