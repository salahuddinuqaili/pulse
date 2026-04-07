import { useState } from "react";

import { MODEL_DATABASE, type ModelEntry } from "../../lib/model-database";

export interface SelectedModel {
  id: string;
  modelName: string;
  family: string;
  params: string;
  quantization: string;
  vram_mb: number;
}

interface ModelSelectorProps {
  onAdd: (model: SelectedModel) => void;
}

export function ModelSelector({ onAdd }: ModelSelectorProps) {
  const [modelName, setModelName] = useState<string>(MODEL_DATABASE[0].name);
  const [quantLabel, setQuantLabel] = useState<string>(
    MODEL_DATABASE[0].quantizations[0].label,
  );

  const selectedModel: ModelEntry | undefined = MODEL_DATABASE.find(
    (m) => m.name === modelName,
  );
  const selectedQuant = selectedModel?.quantizations.find((q) => q.label === quantLabel);

  const handleModelChange = (name: string) => {
    setModelName(name);
    const m = MODEL_DATABASE.find((entry) => entry.name === name);
    if (m && !m.quantizations.some((q) => q.label === quantLabel)) {
      setQuantLabel(m.quantizations[0].label);
    }
  };

  const handleAdd = () => {
    if (!selectedModel || !selectedQuant) return;
    onAdd({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      modelName: selectedModel.name,
      family: selectedModel.family,
      params: selectedModel.params,
      quantization: selectedQuant.label,
      vram_mb: selectedQuant.vram_mb,
    });
  };

  return (
    <div className="bg-surface-elevate rounded-xl p-5 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-display text-muted uppercase tracking-wider mb-2">
            Model
          </label>
          <select
            value={modelName}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-surface text-on-surface font-body text-sm rounded-lg px-3 py-2 border-none outline-none cursor-pointer"
          >
            {MODEL_DATABASE.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.params})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-display text-muted uppercase tracking-wider mb-2">
            Quantization
          </label>
          <select
            value={quantLabel}
            onChange={(e) => setQuantLabel(e.target.value)}
            className="w-full bg-surface text-on-surface font-body text-sm rounded-lg px-3 py-2 border-none outline-none cursor-pointer"
          >
            {selectedModel?.quantizations.map((q) => (
              <option key={q.label} value={q.label}>
                {q.label} — {(q.vram_mb / 1024).toFixed(1)} GB
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted font-body">
          {selectedQuant
            ? `${selectedQuant.vram_mb.toLocaleString()} MB required`
            : "Select a model"}
        </span>
        <button
          onClick={handleAdd}
          disabled={!selectedQuant}
          className="px-4 py-2 bg-primary/15 text-primary font-display text-sm rounded-lg hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Add to plan
        </button>
      </div>
    </div>
  );
}
