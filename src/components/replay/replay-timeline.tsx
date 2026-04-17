import { useCallback, useRef } from "react";

interface ReplayTimelineProps {
  totalFrames: number;
  currentIndex: number;
  ghostLength: number | null;
  onSeek: (index: number) => void;
}

export function ReplayTimeline({
  totalFrames,
  currentIndex,
  ghostLength,
  onSeek,
}: ReplayTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const progress = totalFrames > 0 ? (currentIndex / (totalFrames - 1)) * 100 : 0;
  const ghostProgress =
    ghostLength && totalFrames > 0
      ? (Math.min(ghostLength, totalFrames) / totalFrames) * 100
      : null;

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || totalFrames <= 1) return;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = x / rect.width;
      const index = Math.round(pct * (totalFrames - 1));
      onSeek(index);
    },
    [totalFrames, onSeek],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      seekFromPointer(e.clientX);
    },
    [seekFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0) return;
      seekFromPointer(e.clientX);
    },
    [seekFromPointer],
  );

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div
        ref={barRef}
        className="relative w-full h-6 bg-surface rounded-full cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {/* Ghost session extent */}
        {ghostProgress !== null && (
          <div
            className="absolute top-0 left-0 h-full bg-muted/20 rounded-full"
            style={{ width: `${ghostProgress}%` }}
          />
        )}

        {/* Progress fill */}
        <div
          className="absolute top-0 left-0 h-full bg-primary/30 rounded-full"
          style={{ width: `${progress}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(0,255,102,0.6)]"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs text-muted font-display">
        <span>0:00</span>
        <span>
          {Math.floor(currentIndex / 60)}:
          {String(currentIndex % 60).padStart(2, "0")} /{" "}
          {Math.floor((totalFrames - 1) / 60)}:
          {String((totalFrames - 1) % 60).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
