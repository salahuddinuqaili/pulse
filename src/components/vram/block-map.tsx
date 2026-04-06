import { useRef, useEffect, useCallback, useState } from "react";
import { useGpuStore } from "../../stores/gpu-store";
import { CATEGORY_COLORS } from "../../lib/constants";
import type { ProcessInfo } from "../../lib/types";

const BLOCK_SIZE_MB = 256;
const BLOCK_GAP = 2;
const BLOCK_PX = 24;

interface BlockOwner {
  category: string;
  name: string;
  pid: number;
  vram_mb: number;
}

/** Canvas-based VRAM block map with hover tooltips. */
export function VramBlockMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blockOwnersRef = useRef<Array<BlockOwner | null>>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; owner: BlockOwner } | null>(null);

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
    const blockOwners: Array<BlockOwner | null> = [];
    let usedBlocks = 0;

    for (const proc of processes) {
      const procBlocks = Math.ceil(proc.vram_mb / BLOCK_SIZE_MB);
      for (let i = 0; i < procBlocks && usedBlocks < totalBlocks; i++) {
        blockOwners.push({
          category: proc.category,
          name: proc.name,
          pid: proc.pid,
          vram_mb: proc.vram_mb,
        });
        usedBlocks++;
      }
    }

    // Remaining used VRAM not attributed to known processes
    const unattributedUsedBlocks = Math.ceil(vramUsed / BLOCK_SIZE_MB) - usedBlocks;
    for (let i = 0; i < unattributedUsedBlocks && usedBlocks < totalBlocks; i++) {
      blockOwners.push({ category: "system", name: "System", pid: 0, vram_mb: 0 });
      usedBlocks++;
    }

    // Pad remaining blocks as free (null)
    while (blockOwners.length < totalBlocks) {
      blockOwners.push(null);
    }

    blockOwnersRef.current = blockOwners;

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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const col = Math.floor(mx / (BLOCK_PX + BLOCK_GAP));
      const row = Math.floor(my / (BLOCK_PX + BLOCK_GAP));
      const idx = row * cols + col;

      if (idx >= 0 && idx < blockOwnersRef.current.length) {
        const owner = blockOwnersRef.current[idx];
        if (owner) {
          setTooltip({ x: e.clientX, y: e.clientY, owner });
          return;
        }
      }
      setTooltip(null);
    },
    [cols],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // Legend entries
  const categorySet = new Set(processes.map((p: ProcessInfo) => p.category));

  return (
    <div className="bg-surface-elevate rounded-xl p-4" ref={containerRef}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-display text-muted uppercase tracking-wider">
            VRAM Block Map
          </h3>
          <span className="text-xs text-muted font-body">
            {BLOCK_SIZE_MB}MB per block &middot; {totalBlocks} blocks
          </span>
        </div>
        <span className="font-display text-sm text-primary">
          {(vramUsed / 1024).toFixed(1)} / {(vramTotal / 1024).toFixed(1)} GB
        </span>
      </div>
      {vramTotal === 0 ? (
        <div className="text-sm text-muted font-body py-8 text-center">
          Waiting for GPU data...
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="mx-auto cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
          {tooltip && (
            <div
              className="fixed z-50 bg-surface-highest rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none"
              style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
            >
              <div className="font-display text-on-surface">{tooltip.owner.name}</div>
              <div className="text-muted font-body">
                PID {tooltip.owner.pid} &middot; {tooltip.owner.vram_mb} MB
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-3">
        {Array.from(categorySet).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            <span className="font-display text-muted capitalize">{cat}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-sm border border-surface-highest"
            style={{ backgroundColor: CATEGORY_COLORS.free }}
          />
          <span className="font-display text-muted">Free</span>
        </div>
      </div>
    </div>
  );
}
