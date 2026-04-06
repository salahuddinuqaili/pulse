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
  const progress = totalFrames > 0 ? (currentIndex / (totalFrames - 1)) * 100 : 0;
  const ghostProgress =
    ghostLength && totalFrames > 0
      ? (Math.min(ghostLength, totalFrames) / totalFrames) * 100
      : null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const index = Math.round(pct * (totalFrames - 1));
    onSeek(index);
  };

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div
        className="relative w-full h-6 bg-surface rounded-full cursor-pointer"
        onClick={handleClick}
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
          className="absolute top-0 left-0 h-full bg-primary/30 rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(0,255,102,0.6)] transition-all duration-100"
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
