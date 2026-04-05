import { useGpuStore } from "../../stores/gpu-store";
import { getHeadroomLevel, HEADROOM_LABELS, COLORS } from "../../lib/constants";

const LEVEL_COLORS: Record<string, string> = {
  comfortable: COLORS.primary,
  moderate: "#FBBF24",
  limited: "#F97316",
  tight: COLORS.warning,
  critical: COLORS.warning,
};

export function HeadroomIndicator() {
  const vramFree = useGpuStore((s) => s.current?.vram_free_mb ?? 0);
  const processes = useGpuStore((s) => s.current?.processes ?? []);

  const level = getHeadroomLevel(vramFree);
  const color = LEVEL_COLORS[level];
  const freeGb = (vramFree / 1024).toFixed(1);

  // Build contextual suffix from detected processes
  const aiProcs = processes.filter((p) => p.category === "ai");
  const suffix = aiProcs.length > 0
    ? ` after ${aiProcs.map((p) => p.name).join(", ")}`
    : "";

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span
          className={`font-display text-2xl ${level === "critical" ? "animate-pulse" : ""}`}
          style={{ color }}
        >
          {freeGb} GB
        </span>
        <span className="text-sm text-on-surface font-display">Available{suffix}</span>
      </div>
      <p className="text-xs text-muted font-body mt-1">
        {HEADROOM_LABELS[level]}
      </p>
    </div>
  );
}
