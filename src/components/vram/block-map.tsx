import { useRef, useEffect, useCallback } from "react";
import { useGpuStore } from "../../stores/gpu-store";
import { CATEGORY_COLORS } from "../../lib/constants";

const BLOCK_SIZE_MB = 256;
const BLOCK_GAP = 2;
const BLOCK_PX = 24;

/** Canvas-based VRAM block map — renders one block per BLOCK_SIZE_MB of VRAM. */
export function VramBlockMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vramTotal = useGpuStore((s) => s.current?.vram_total_mb ?? 0);
  const vramUsed = useGpuStore((s) => s.current?.vram_used_mb ?? 0);
  const processes = useGpuStore((s) => s.current?.processes ?? []);

  const totalBlocks = Math.ceil(vramTotal / BLOCK_SIZE_MB);
  const cols = Math.max(1, Math.min(24, totalBlocks));
  const rows = Math.ceil(totalBlocks / cols);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || totalBlocks === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = cols * (BLOCK_PX + BLOCK_GAP);
    const height = rows * (BLOCK_PX + BLOCK_GAP);
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Build block ownership: assign process blocks proportionally
    const blockOwners: Array<{ category: string; name: string }> = [];
    let usedBlocks = 0;

    for (const proc of processes) {
      const procBlocks = Math.ceil(proc.vram_mb / BLOCK_SIZE_MB);
      for (let i = 0; i < procBlocks && usedBlocks < totalBlocks; i++) {
        blockOwners.push({ category: proc.category, name: proc.name });
        usedBlocks++;
      }
    }

    // Remaining used VRAM not attributed to known processes → system
    const unattributedUsedBlocks = Math.ceil(vramUsed / BLOCK_SIZE_MB) - usedBlocks;
    for (let i = 0; i < unattributedUsedBlocks && usedBlocks < totalBlocks; i++) {
      blockOwners.push({ category: "system", name: "System" });
      usedBlocks++;
    }

    for (let idx = 0; idx < totalBlocks; idx++) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = col * (BLOCK_PX + BLOCK_GAP);
      const y = row * (BLOCK_PX + BLOCK_GAP);

      const owner = blockOwners[idx];
      const color = owner
        ? CATEGORY_COLORS[owner.category as keyof typeof CATEGORY_COLORS] ?? CATEGORY_COLORS.unknown
        : CATEGORY_COLORS.free;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, BLOCK_PX, BLOCK_PX, 3);
      ctx.fill();
    }
  }, [totalBlocks, cols, rows, vramUsed, processes]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider">
          VRAM Block Map
        </h3>
        <span className="text-xs font-display text-on-surface">
          {(vramUsed / 1024).toFixed(1)} / {(vramTotal / 1024).toFixed(1)} GB
        </span>
      </div>
      {vramTotal === 0 ? (
        <div className="text-sm text-muted font-body py-8 text-center">
          Waiting for GPU data...
        </div>
      ) : (
        <canvas ref={canvasRef} className="mx-auto" />
      )}
    </div>
  );
}
