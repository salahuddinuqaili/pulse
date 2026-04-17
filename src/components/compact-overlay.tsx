import { useGpuStore } from "../stores/gpu-store";
import { getTemperatureColor } from "../lib/constants";

export function CompactOverlay() {
  const gpuUtil = useGpuStore((s) => s.current?.gpu_utilization ?? 0);
  const vramUsed = useGpuStore((s) => s.current?.vram_used_mb ?? 0);
  const vramTotal = useGpuStore((s) => s.current?.vram_total_mb ?? 0);
  const tempC = useGpuStore((s) => s.current?.temperature_c ?? 0);
  const powerDraw = useGpuStore((s) => s.current?.power_draw_w ?? 0);
  const powerLimit = useGpuStore((s) => s.current?.power_limit_w ?? 0);
  const fanSpeed = useGpuStore((s) => s.current?.fan_speed_pct);

  const vramPct = vramTotal > 0 ? (vramUsed / vramTotal) * 100 : 0;
  const vramUsedGb = (vramUsed / 1024).toFixed(1);
  const vramTotalGb = (vramTotal / 1024).toFixed(1);

  return (
    <div className="h-full w-full bg-background p-4 flex flex-col gap-3 select-none"
      data-tauri-drag-region
    >
      {/* Header */}
      <div className="flex items-center justify-between" data-tauri-drag-region>
        <span className="font-display text-sm text-primary tracking-wider">PULSE</span>
        <span className="text-xs font-display text-muted">COMPACT</span>
      </div>

      {/* Temperature */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-display text-muted uppercase">Temperature</span>
        <span className="font-display text-2xl" style={{ color: getTemperatureColor(tempC) }}>
          {tempC}°C
        </span>
      </div>

      {/* GPU Utilization */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-display text-muted uppercase">GPU Load</span>
          <span className="font-display text-sm text-primary">{gpuUtil}%</span>
        </div>
        <div className="w-full h-2 bg-background rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${gpuUtil}%` }}
          />
        </div>
      </div>

      {/* VRAM Bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-display text-muted uppercase">VRAM</span>
          <span className="font-display text-sm text-on-surface">
            {vramUsedGb} / {vramTotalGb} GB
          </span>
        </div>
        <div className="w-full h-2 bg-background rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${vramPct}%` }}
          />
        </div>
      </div>

      {/* Power */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-display text-muted uppercase">Power</span>
          <span className="font-display text-sm text-on-surface">
            {powerDraw.toFixed(0)}W / {powerLimit.toFixed(0)}W
          </span>
        </div>
        <div className="w-full h-2 bg-background rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${powerLimit > 0 ? Math.min((powerDraw / powerLimit) * 100, 100) : 0}%` }}
          />
        </div>
      </div>

      {/* Fan */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-display text-muted uppercase">Fan Speed</span>
        <span className="font-display text-sm text-on-surface">
          {fanSpeed != null ? `${fanSpeed}%` : "N/A"}
        </span>
      </div>

      {/* FPS Placeholder */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-highest/20">
        <span className="text-xs font-display text-muted uppercase">Live FPS</span>
        <span className="font-display text-lg text-muted">{"\u2014"}</span>
      </div>
    </div>
  );
}
