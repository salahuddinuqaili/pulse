import type { SelectedModel } from "./model-selector";

interface ModelStackProps {
  models: SelectedModel[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function ModelStack({ models, onRemove, onClear }: ModelStackProps) {
  if (models.length === 0) {
    return (
      <div className="bg-surface-elevate rounded-xl p-8 text-center">
        <p className="text-sm text-muted font-body">
          No models in plan. Add a model above to project VRAM impact.
        </p>
      </div>
    );
  }

  const total = models.reduce((sum, m) => sum + m.vram_mb, 0);

  return (
    <div className="bg-surface-elevate rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-surface/40">
        <span className="text-xs font-display text-muted uppercase tracking-wider">
          Planned models ({models.length})
        </span>
        <button
          onClick={onClear}
          className="text-xs font-display text-muted hover:text-warning transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="divide-y divide-surface/30">
        {models.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between px-5 py-3 hover:bg-surface/20 transition-colors"
          >
            <div className="flex flex-col">
              <span className="text-sm font-body text-on-surface">{m.modelName}</span>
              <span className="text-xs font-display text-muted">
                {m.family} · {m.params} · {m.quantization}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-display text-sm text-primary">
                {(m.vram_mb / 1024).toFixed(1)} GB
              </span>
              <button
                onClick={() => onRemove(m.id)}
                className="text-muted hover:text-warning text-lg leading-none"
                aria-label={`Remove ${m.modelName}`}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-5 py-3 bg-surface/40">
        <span className="text-xs font-display text-muted uppercase tracking-wider">
          Total
        </span>
        <span className="font-display text-sm text-on-surface">
          {(total / 1024).toFixed(1)} GB
        </span>
      </div>
    </div>
  );
}
