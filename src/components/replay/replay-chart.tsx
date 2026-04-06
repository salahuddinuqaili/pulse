import { useRef, useEffect, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import type { GpuSnapshot } from "../../lib/types";
import { COLORS } from "../../lib/constants";

const CHART_HEIGHT = 250;

type MetricKey = "temperature" | "clocks" | "fps" | "power" | "vram";

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "temperature", label: "Temperature (C)" },
  { key: "clocks", label: "Clock Speed (MHz)" },
  { key: "fps", label: "FPS" },
  { key: "power", label: "Power (W)" },
  { key: "vram", label: "VRAM Used (MB)" },
];

function extractMetric(snapshots: GpuSnapshot[], metric: MetricKey): number[] {
  switch (metric) {
    case "temperature":
      return snapshots.map((s) => s.temperature_c);
    case "clocks":
      return snapshots.map((s) => s.clock_graphics_mhz);
    case "fps":
      return snapshots.map((s) => s.fps_current ?? 0);
    case "power":
      return snapshots.map((s) => s.power_draw_w);
    case "vram":
      return snapshots.map((s) => s.vram_used_mb);
  }
}

interface ReplayChartProps {
  session: GpuSnapshot[];
  ghostSession: GpuSnapshot[] | null;
  currentIndex: number;
}

export function ReplayChart({
  session,
  ghostSession,
  currentIndex,
}: ReplayChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [metric, setMetric] = useState<MetricKey>("temperature");

  useEffect(() => {
    if (!containerRef.current || session.length === 0) return;
    const width = containerRef.current.clientWidth;

    const series: uPlot.Series[] = [
      {},
      {
        label: "Current",
        stroke: COLORS.primary,
        width: 2,
      },
    ];

    if (ghostSession && ghostSession.length > 0) {
      series.push({
        label: "Ghost",
        stroke: COLORS.muted,
        width: 1,
        dash: [6, 4],
      });
    }

    const opts: uPlot.Options = {
      width,
      height: CHART_HEIGHT,
      cursor: { show: true },
      scales: {
        x: { time: false },
        y: { auto: true },
      },
      series,
      axes: [
        {
          stroke: COLORS.muted,
          grid: { stroke: "rgba(139, 144, 154, 0.1)" },
          font: "11px 'Space Grotesk'",
          ticks: { stroke: "rgba(139, 144, 154, 0.1)" },
        },
        {
          stroke: COLORS.muted,
          grid: { stroke: "rgba(139, 144, 154, 0.1)" },
          font: "11px 'Space Grotesk'",
          ticks: { stroke: "rgba(139, 144, 154, 0.1)" },
        },
      ],
    };

    const xValues = session.map((_, i) => i);
    const currentValues = extractMetric(session, metric);
    const data: uPlot.AlignedData = [xValues, currentValues];

    if (ghostSession && ghostSession.length > 0) {
      const ghostValues = extractMetric(
        ghostSession.slice(0, session.length),
        metric
      );
      // Pad if ghost is shorter
      while (ghostValues.length < session.length) {
        ghostValues.push(ghostValues[ghostValues.length - 1] ?? 0);
      }
      data.push(ghostValues);
    }

    chartRef.current = new uPlot(opts, data, containerRef.current);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartRef.current?.setSize({
          width: entry.contentRect.width,
          height: CHART_HEIGHT,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [session, ghostSession, metric]);

  // Update cursor position to reflect current playback index
  useEffect(() => {
    if (chartRef.current && session.length > 0) {
      chartRef.current.setCursor({ left: (currentIndex / session.length) * chartRef.current.width, top: 0 });
    }
  }, [currentIndex, session.length]);

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-display text-muted uppercase tracking-wider">
          Session Chart
        </h3>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricKey)}
          className="text-xs font-display text-muted bg-surface rounded px-2 py-1 outline-none"
        >
          {METRIC_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
