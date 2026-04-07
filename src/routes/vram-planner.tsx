import { useState, useMemo } from "react";

import { useGpuStore } from "../stores/gpu-store";
import { ModelSelector, type SelectedModel } from "../components/planner/model-selector";
import { ModelStack } from "../components/planner/model-stack";
import { VramProjectionBar } from "../components/planner/vram-projection-bar";
import { ErrorState } from "../components/shared/error-state";

export function VramPlanner() {
  const nvmlError = useGpuStore((s) => s.nvmlError);
  const vramTotal = useGpuStore((s) => s.current?.vram_total_mb ?? 0);
  const vramUsed = useGpuStore((s) => s.current?.vram_used_mb ?? 0);

  const [models, setModels] = useState<SelectedModel[]>([]);

  const projectedMb = useMemo(
    () => models.reduce((sum, m) => sum + m.vram_mb, 0),
    [models],
  );

  if (nvmlError) {
    return <ErrorState title="NVML Unavailable" message={nvmlError} />;
  }

  const totalProjected = vramUsed + projectedMb;
  const fits = totalProjected <= vramTotal;
  const remainingMb = vramTotal - totalProjected;

  const handleAdd = (model: SelectedModel) => setModels((prev) => [...prev, model]);
  const handleRemove = (id: string) =>
    setModels((prev) => prev.filter((m) => m.id !== id));
  const handleClear = () => setModels([]);

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-on-surface tracking-tight">
            VRAM Budget Planner
          </h1>
          <p className="text-sm text-muted font-body mt-1">
            Project model loading against current GPU usage.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-display text-muted uppercase tracking-wider">
            Currently using
          </div>
          <div className="font-display text-lg text-on-surface">
            {(vramUsed / 1024).toFixed(1)} / {(vramTotal / 1024).toFixed(1)} GB
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-display text-muted uppercase tracking-wider">
          Projected VRAM
        </h2>
        <VramProjectionBar
          currentUsedMb={vramUsed}
          totalMb={vramTotal}
          projectedAdditionalMb={projectedMb}
        />
        <Verdict
          fits={fits}
          remainingMb={remainingMb}
          modelCount={models.length}
        />
      </section>

      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Add Model
        </h2>
        <ModelSelector onAdd={handleAdd} />
      </section>

      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Plan
        </h2>
        <ModelStack models={models} onRemove={handleRemove} onClear={handleClear} />
      </section>
    </div>
  );
}

interface VerdictProps {
  fits: boolean;
  remainingMb: number;
  modelCount: number;
}

function Verdict({ fits, remainingMb, modelCount }: VerdictProps) {
  if (modelCount === 0) {
    return (
      <p className="text-sm text-muted font-body">
        Add a model above to see projected VRAM impact.
      </p>
    );
  }

  if (fits) {
    return (
      <p className="text-sm font-body text-primary">
        ✓ These models will fit with{" "}
        <span className="font-display">{(remainingMb / 1024).toFixed(1)} GB</span>{" "}
        remaining.
      </p>
    );
  }

  const overflowGb = (Math.abs(remainingMb) / 1024).toFixed(1);
  return (
    <p className="text-sm font-body text-warning">
      ✗ These models exceed available VRAM by{" "}
      <span className="font-display">{overflowGb} GB</span>.
    </p>
  );
}
