import { useGpuStore } from "../../stores/gpu-store";
import { CATEGORY_COLORS } from "../../lib/constants";
import type { ProcessInfo } from "../../lib/types";

/** Compact horizontal stacked bar showing VRAM by category. */
export function VramStackedBar() {
  const processes = useGpuStore((s) => s.current?.processes ?? []);
  const vramTotal = useGpuStore((s) => s.current?.vram_total_mb ?? 0);
  const vramUsed = useGpuStore((s) => s.current?.vram_used_mb ?? 0);

  if (vramTotal === 0) return null;

  const grouped = groupByCategory(processes);
  const freeMb = Math.max(0, vramTotal - vramUsed);

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider">
          VRAM Allocation
        </h3>
        <span className="text-xs font-display text-on-surface">
          {(vramUsed / 1024).toFixed(1)} / {(vramTotal / 1024).toFixed(1)} GB
        </span>
      </div>

      <div className="flex h-6 rounded-lg overflow-hidden">
        {grouped.map(({ category, totalMb }) => (
          <div
            key={category}
            className="transition-all"
            style={{
              width: `${(totalMb / vramTotal) * 100}%`,
              backgroundColor: CATEGORY_COLORS[category],
            }}
            title={`${category}: ${totalMb} MB`}
          />
        ))}
        <div
          className="transition-all"
          style={{
            width: `${(freeMb / vramTotal) * 100}%`,
            backgroundColor: CATEGORY_COLORS.free,
          }}
          title={`Free: ${freeMb} MB`}
        />
      </div>

      <div className="flex flex-wrap gap-4 mt-2">
        {grouped.map(({ category, totalMb }) => (
          <div key={category} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            />
            <span className="font-display text-muted capitalize">{category}</span>
            <span className="font-display text-on-surface">{totalMb} MB</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className="w-2 h-2 rounded-full border border-surface-highest"
            style={{ backgroundColor: CATEGORY_COLORS.free }}
          />
          <span className="font-display text-muted">Free</span>
          <span className="font-display text-on-surface">{freeMb} MB</span>
        </div>
      </div>
    </div>
  );
}

function groupByCategory(processes: ProcessInfo[]) {
  const groups: Record<string, number> = {};
  for (const p of processes) {
    groups[p.category] = (groups[p.category] ?? 0) + p.vram_mb;
  }
  return Object.entries(groups)
    .filter(([, mb]) => mb > 0)
    .map(([category, totalMb]) => ({
      category: category as ProcessInfo["category"],
      totalMb,
    }));
}
