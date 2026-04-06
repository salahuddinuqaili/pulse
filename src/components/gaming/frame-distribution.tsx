import { useRef, useEffect, useCallback } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { useGpuStore, type FrameTimeSample } from "../../stores/gpu-store";
import { COLORS } from "../../lib/constants";

const CHART_HEIGHT = 160;

const BUCKETS = [
  { label: "<8ms", min: 0, max: 8, color: COLORS.primary },
  { label: "8-12ms", min: 8, max: 12, color: COLORS.primary },
  { label: "12-16ms", min: 12, max: 16, color: COLORS.primary },
  { label: "16-20ms", min: 16, max: 20, color: COLORS.muted },
  { label: "20-33ms", min: 20, max: 33, color: COLORS.warning },
  { label: "33ms+", min: 33, max: Infinity, color: COLORS.warning },
] as const;

export function FrameDistribution() {
  const getFrameTimeSlice = useGpuStore((s) => s.getFrameTimeSlice);
  const frameTimeMs = useGpuStore((s) => s.current?.frame_time_ms ?? null);

  const computeBuckets = useCallback((): number[] => {
    const samples: FrameTimeSample[] = getFrameTimeSlice(300);
    if (samples.length === 0) return BUCKETS.map(() => 0);

    const counts = BUCKETS.map(() => 0);
    for (const s of samples) {
      for (let i = 0; i < BUCKETS.length; i++) {
        if (s.ms >= BUCKETS[i].min && s.ms < BUCKETS[i].max) {
          counts[i]++;
          break;
        }
      }
    }
    const total = samples.length;
    return counts.map((c) => (total > 0 ? (c / total) * 100 : 0));
  }, [getFrameTimeSlice]);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const percentages = computeBuckets();

    const opts: uPlot.Options = {
      width,
      height: CHART_HEIGHT,
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { auto: true, range: [0, 100] },
      },
      series: [
        {},
        {
          label: "%",
          fill: COLORS.primary,
          stroke: COLORS.primary,
          width: 0,
          paths: uPlot.paths.bars!({ size: [0.6, 64] }),
        },
      ],
      axes: [
        {
          stroke: COLORS.muted,
          grid: { show: false },
          font: "11px 'Space Grotesk'",
          ticks: { show: false },
          values: (_self, splits) =>
            splits.map((i) => BUCKETS[i]?.label ?? ""),
        },
        {
          stroke: COLORS.muted,
          grid: { stroke: "rgba(139, 144, 154, 0.1)" },
          font: "11px 'Space Grotesk'",
          ticks: { stroke: "rgba(139, 144, 154, 0.1)" },
          label: "%",
          labelFont: "11px 'Space Grotesk'",
          labelSize: 20,
        },
      ],
    };

    const xValues = BUCKETS.map((_, i) => i);
    chartRef.current = new uPlot(opts, [xValues, percentages], containerRef.current);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chartRef.current || frameTimeMs === null) return;
    const percentages = computeBuckets();
    const xValues = BUCKETS.map((_, i) => i);
    chartRef.current.setData([xValues, percentages]);
  }, [frameTimeMs, computeBuckets]);

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
        Performance Consistency
      </h3>
      <div ref={containerRef} />
      {frameTimeMs === null && (
        <div className="py-6 text-center text-sm text-muted font-body">
          No frame-time data available
        </div>
      )}
    </div>
  );
}
