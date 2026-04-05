import { useGpuStore } from "../../stores/gpu-store";

export function MetricCards() {
  const memUtil = useGpuStore((s) => s.current?.memory_utilization ?? 0);
  const gpuUtil = useGpuStore((s) => s.current?.gpu_utilization ?? 0);
  const pcieGen = useGpuStore((s) => s.current?.pcie_link_gen);
  const pcieWidth = useGpuStore((s) => s.current?.pcie_link_width);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="GPU Utilization" value={`${gpuUtil}%`} sublabel={gpuUtil > 90 ? "Spiking" : "Steady"} />
      <StatCard label="Memory Controller" value={`${memUtil}%`} sublabel="Bandwidth" />
      <StatCard
        label="PCIe Link"
        value={pcieGen != null ? `Gen${pcieGen} x${pcieWidth ?? "?"}` : "N/A"}
        sublabel="Bus Interface"
      />
      <StatCard label="Live FPS" value="\u2014" sublabel="PresentMon v0.2" />
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="bg-surface-elevate rounded-lg p-4">
      <span className="text-xs text-muted font-display uppercase tracking-wider">{label}</span>
      <div className="font-display text-xl text-on-surface mt-1">{value}</div>
      <span className="text-xs text-muted font-body">{sublabel}</span>
    </div>
  );
}
