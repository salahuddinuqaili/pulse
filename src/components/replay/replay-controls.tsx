interface ReplayControlsProps {
  isPlaying: boolean;
  playbackSpeed: number;
  hasGhost: boolean;
  onTogglePlayback: () => void;
  onSetSpeed: (speed: number) => void;
  onSelectGhost: () => void;
  onClearGhost: () => void;
  onExportPng: () => void;
  onExportMarkdown: () => void;
}

const SPEEDS = [1, 2, 4];

export function ReplayControls({
  isPlaying,
  playbackSpeed,
  hasGhost,
  onTogglePlayback,
  onSetSpeed,
  onSelectGhost,
  onClearGhost,
  onExportPng,
  onExportMarkdown,
}: ReplayControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlayback}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        {isPlaying ? (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Speed selector */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            className={`px-2 py-1 text-xs font-display rounded transition-colors ${
              playbackSpeed === speed
                ? "bg-primary/20 text-primary"
                : "text-muted hover:text-on-surface"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-surface-highest" />

      {/* Ghost controls */}
      {hasGhost ? (
        <button
          onClick={onClearGhost}
          className="text-xs font-display text-muted hover:text-warning transition-colors px-2 py-1 rounded hover:bg-surface-elevate"
        >
          Clear Ghost
        </button>
      ) : (
        <button
          onClick={onSelectGhost}
          className="text-xs font-display text-muted hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-elevate"
        >
          Select Ghost
        </button>
      )}

      <div className="w-px h-5 bg-surface-highest" />

      {/* Export */}
      <button
        onClick={onExportPng}
        className="text-xs font-display text-muted hover:text-on-surface transition-colors px-2 py-1 rounded hover:bg-surface-elevate"
      >
        PNG
      </button>
      <button
        onClick={onExportMarkdown}
        className="text-xs font-display text-muted hover:text-on-surface transition-colors px-2 py-1 rounded hover:bg-surface-elevate"
      >
        Markdown
      </button>
    </div>
  );
}
