import type { GpuSnapshot } from "../../lib/types";

interface DeltaIndicatorsProps {
  current: GpuSnapshot;
  ghost: GpuSnapshot;
}

export function DeltaIndicators({ current, ghost }: DeltaIndicatorsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <DeltaCard
        label="Temperature"
        currentValue={current.temperature_c}
        ghostValue={ghost.temperature_c}
        unit="C"
        lowerIsBetter
      />
      <DeltaCard
        label="Clock Speed"
        currentValue={current.clock_graphics_mhz}
        ghostValue={ghost.clock_graphics_mhz}
        unit="MHz"
      />
      <DeltaCard
        label="Fan Speed"
        currentValue={current.fan_speed_pct ?? 0}
        ghostValue={ghost.fan_speed_pct ?? 0}
        unit="%"
        lowerIsBetter
      />
      {current.fps_current != null && ghost.fps_current != null && (
        <DeltaCard
          label="FPS"
          currentValue={Math.round(current.fps_current)}
          ghostValue={Math.round(ghost.fps_current)}
          unit=""
        />
      )}
    </div>
  );
}

function DeltaCard({
  label,
  currentValue,
  ghostValue,
  unit,
  lowerIsBetter = false,
}: {
  label: string;
  currentValue: number;
  ghostValue: number;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  const delta = currentValue - ghostValue;
  const isBetter = lowerIsBetter ? delta < 0 : delta > 0;
  const isWorse = lowerIsBetter ? delta > 0 : delta < 0;
  const sign = delta > 0 ? "+" : "";
  const color = isBetter
    ? "text-primary"
    : isWorse
      ? "text-warning"
      : "text-muted";

  return (
    <div className="bg-surface-elevate rounded-lg p-3">
      <span className="text-xs text-muted font-display uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-end gap-2 mt-1">
        <span className="font-display text-lg text-on-surface">
          {currentValue}
          {unit && <span className="text-xs text-muted ml-0.5">{unit}</span>}
        </span>
        <span className={`font-display text-sm ${color}`}>
          {sign}
          {delta}
          {unit}
        </span>
      </div>
      <span className="text-xs text-muted font-body">
        Ghost: {ghostValue}
        {unit}
      </span>
    </div>
  );
}
