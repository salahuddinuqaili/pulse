interface VramProjectionBarProps {
  currentUsedMb: number;
  totalMb: number;
  projectedAdditionalMb: number;
}

/**
 * Stacked horizontal bar visualising current VRAM usage plus a projected
 * model load on top. Turns red when the projected total exceeds the device's
 * VRAM capacity.
 */
export function VramProjectionBar({
  currentUsedMb,
  totalMb,
  projectedAdditionalMb,
}: VramProjectionBarProps) {
  if (totalMb === 0) {
    return (
      <div className="h-12 bg-surface-elevate rounded-xl flex items-center justify-center">
        <span className="text-xs text-muted font-body">No GPU data</span>
      </div>
    );
  }

  const totalProjected = currentUsedMb + projectedAdditionalMb;
  const exceeds = totalProjected > totalMb;

  // Cap segment widths at 100%; if exceeds, show overflow segment in warning
  const currentPct = Math.min((currentUsedMb / totalMb) * 100, 100);
  const projectedFitsMb = Math.max(0, Math.min(projectedAdditionalMb, totalMb - currentUsedMb));
  const projectedPct = (projectedFitsMb / totalMb) * 100;
  const overflowMb = Math.max(0, totalProjected - totalMb);
  const overflowPct = totalMb > 0 ? Math.min((overflowMb / totalMb) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-12 bg-surface-elevate rounded-xl overflow-hidden">
        {/* Current usage */}
        <div
          className="absolute top-0 left-0 h-full bg-on-surface/40 transition-all"
          style={{ width: `${currentPct}%` }}
        />
        {/* Projected fits */}
        <div
          className={`absolute top-0 h-full transition-all ${
            exceeds ? "bg-warning/70" : "bg-primary/70"
          }`}
          style={{ left: `${currentPct}%`, width: `${projectedPct}%` }}
        />
        {/* Overflow band — visible only when exceeds total */}
        {exceeds && (
          <div
            className="absolute top-0 h-full bg-warning"
            style={{
              left: `${100 - overflowPct}%`,
              width: `${overflowPct}%`,
              opacity: 0.9,
            }}
          />
        )}

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-display text-sm text-on-surface">
            {(totalProjected / 1024).toFixed(1)} / {(totalMb / 1024).toFixed(1)} GB
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-display text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-on-surface/40" />
          Currently used
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-sm ${exceeds ? "bg-warning/70" : "bg-primary/70"}`}
          />
          Projected models
        </span>
        {exceeds && (
          <span className="flex items-center gap-1.5 text-warning">
            <span className="w-2 h-2 rounded-sm bg-warning" />
            Overflow
          </span>
        )}
      </div>
    </div>
  );
}
