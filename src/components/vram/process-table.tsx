import { useGpuStore } from "../../stores/gpu-store";
import { CATEGORY_COLORS } from "../../lib/constants";

/** Active GPU process table with classification tags. */
export function ProcessTable() {
  const processes = useGpuStore((s) => s.current?.processes ?? []);

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
        Active GPU Processes
      </h3>
      {processes.length === 0 ? (
        <div className="text-sm text-muted font-body py-4 text-center">
          No GPU processes detected
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted font-display uppercase tracking-wider border-b border-surface-highest/20">
                <th className="text-left py-2 pr-4">Process</th>
                <th className="text-left py-2 pr-4">Category</th>
                <th className="text-right py-2 pr-4">VRAM</th>
                <th className="text-right py-2">PID</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((proc) => (
                <tr
                  key={proc.pid}
                  className="border-b border-surface-highest/10 hover:bg-surface/50 transition-colors"
                >
                  <td className="py-2 pr-4 font-display text-on-surface">
                    {proc.name}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-display"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[proc.category]}20`,
                        color: CATEGORY_COLORS[proc.category],
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[proc.category] }}
                      />
                      {proc.category}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-display text-on-surface">
                    {proc.vram_mb} MB
                  </td>
                  <td className="py-2 text-right font-display text-muted">
                    {proc.pid}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
