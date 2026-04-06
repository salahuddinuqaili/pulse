import { useGpuStore } from "../../stores/gpu-store";

export function FpsCounter() {
  const fpsCurrent = useGpuStore((s) => s.current?.fps_current ?? null);
  const fpsAvg = useGpuStore((s) => s.current?.fps_avg ?? null);
  const fps1pct = useGpuStore((s) => s.current?.fps_1pct_low ?? null);
  const fps01pct = useGpuStore((s) => s.current?.fps_01pct_low ?? null);

  const fpsColor =
    fpsCurrent === null
      ? "text-muted"
      : fpsCurrent >= 60
        ? "text-primary"
        : fpsCurrent >= 30
          ? "text-on-surface"
          : "text-warning";

  return (
    <div className="bg-surface-elevate rounded-xl p-6">
      <div className="flex items-end gap-6">
        {/* Big FPS number */}
        <div>
          <span className={`font-display text-7xl font-bold tracking-tighter ${fpsColor}`}>
            {fpsCurrent !== null ? Math.round(fpsCurrent) : "\u2014"}
          </span>
          <span className="text-sm text-muted font-display ml-2 uppercase">FPS</span>
        </div>

        {/* Supporting metrics */}
        <div className="flex gap-6 pb-2">
          <FpsStat label="AVG" value={fpsAvg} />
          <FpsStat label="1% LOW" value={fps1pct} />
          <FpsStat label="0.1% LOW" value={fps01pct} />
        </div>
      </div>
    </div>
  );
}

function FpsStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted font-display uppercase tracking-wider">
        {label}
      </span>
      <span className="font-display text-lg text-on-surface">
        {value !== null ? Math.round(value) : "\u2014"}
      </span>
    </div>
  );
}
