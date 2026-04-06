import { useRef, useEffect } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import type { SessionMetadata } from "../../lib/types";
import { COLORS } from "../../lib/constants";

const CHART_HEIGHT = 140;

interface MultiMetricChartProps {
  sessions: SessionMetadata[];
}

export function MultiMetricChart({ sessions }: MultiMetricChartProps) {
  const tempRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const fanRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<uPlot[]>([]);

  useEffect(() => {
    // Clean up previous charts
    chartsRef.current.forEach((c) => c.destroy());
    chartsRef.current = [];

    if (sessions.length === 0) return;
    if (!tempRef.current || !clockRef.current || !fanRef.current) return;

    const sortedSessions = [...sessions].sort(
      (a, b) => a.start_ms - b.start_ms
    );
    const timestamps = sortedSessions.map((s) => s.start_ms / 1000);

    const syncKey = uPlot.sync("analytics");

    const makeOpts = (
      label: string,
      unit: string,
      color: string
    ): uPlot.Options => ({
      width: tempRef.current!.clientWidth,
      height: CHART_HEIGHT,
      cursor: {
        lock: true,
        sync: { key: syncKey.key },
      },
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      series: [
        {},
        {
          label,
          stroke: color,
          width: 2,
          fill: `${color}15`,
          points: { size: 4 },
        },
      ],
      axes: [
        {
          stroke: COLORS.muted,
          grid: { stroke: "rgba(139, 144, 154, 0.1)" },
          font: "10px 'Space Grotesk'",
          ticks: { stroke: "rgba(139, 144, 154, 0.1)" },
        },
        {
          stroke: COLORS.muted,
          grid: { stroke: "rgba(139, 144, 154, 0.1)" },
          font: "10px 'Space Grotesk'",
          ticks: { stroke: "rgba(139, 144, 154, 0.1)" },
          label: unit,
          labelFont: "10px 'Space Grotesk'",
          labelSize: 18,
        },
      ],
      legend: { show: false },
    });

    // Temperature chart
    const tempValues = sortedSessions.map(
      (s) => s.aggregates?.avg_temp ?? 0
    );
    const tempChart = new uPlot(
      makeOpts("Avg Temp", "C", COLORS.warning),
      [timestamps, tempValues],
      tempRef.current
    );

    // Clock speed chart
    const clockValues = sortedSessions.map(
      (s) => s.aggregates?.avg_clock_graphics_mhz ?? 0
    );
    const clockChart = new uPlot(
      makeOpts("Avg Clock", "MHz", COLORS.primary),
      [timestamps, clockValues],
      clockRef.current
    );

    // Fan speed chart (use max power as proxy since fan isn't in aggregates)
    const powerValues = sortedSessions.map(
      (s) => s.aggregates?.avg_power_w ?? 0
    );
    const fanChart = new uPlot(
      makeOpts("Avg Power", "W", "#FBBF24"),
      [timestamps, powerValues],
      fanRef.current
    );

    chartsRef.current = [tempChart, clockChart, fanChart];

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartsRef.current.forEach((c) =>
          c.setSize({
            width: entry.contentRect.width,
            height: CHART_HEIGHT,
          })
        );
      }
    });
    observer.observe(tempRef.current);

    return () => {
      observer.disconnect();
      chartsRef.current.forEach((c) => c.destroy());
      chartsRef.current = [];
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="bg-surface-elevate rounded-xl p-6 text-center">
        <p className="text-sm text-muted font-body">
          No sessions in this time range. Record a session to see analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-elevate rounded-xl p-4">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-2">
          Temperature
        </h3>
        <div ref={tempRef} />
      </div>
      <div className="bg-surface-elevate rounded-xl p-4">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-2">
          Clock Speed
        </h3>
        <div ref={clockRef} />
      </div>
      <div className="bg-surface-elevate rounded-xl p-4">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-2">
          Power Draw
        </h3>
        <div ref={fanRef} />
      </div>
    </div>
  );
}
