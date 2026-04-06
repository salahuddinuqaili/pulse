export type TimeRange = "1D" | "1W" | "1M";

interface TimeRangeTabsProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

const RANGES: TimeRange[] = ["1D", "1W", "1M"];

export function TimeRangeTabs({ selected, onChange }: TimeRangeTabsProps) {
  return (
    <div className="flex gap-1 bg-surface rounded-lg p-1">
      {RANGES.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`px-4 py-1.5 text-xs font-display rounded-md transition-colors ${
            selected === range
              ? "bg-primary/20 text-primary"
              : "text-muted hover:text-on-surface"
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export function getTimeRangeMs(range: TimeRange): { start: number; end: number } {
  const now = Date.now();
  const durations: Record<TimeRange, number> = {
    "1D": 24 * 60 * 60 * 1000,
    "1W": 7 * 24 * 60 * 60 * 1000,
    "1M": 30 * 24 * 60 * 60 * 1000,
  };
  return { start: now - durations[range], end: now };
}
