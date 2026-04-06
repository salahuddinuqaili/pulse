import { useRef, useEffect, useCallback } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { useGpuStore, type FrameTimeSample } from "../../stores/gpu-store";
import { COLORS } from "../../lib/constants";

const CHART_HEIGHT = 200;
const TARGET_60FPS_MS = 16.67;

export function FrameTimeChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const getFrameTimeSlice = useGpuStore((s) => s.getFrameTimeSlice);
  const frameTimeMs = useGpuStore((s) => s.current?.frame_time_ms ?? null);

  const buildData = useCallback((): uPlot.AlignedData => {
    const samples: FrameTimeSample[] = getFrameTimeSlice(300);
    if (samples.length === 0) {
      return [[], [], []];
    }
    const timestamps = samples.map((s) => s.timestamp / 1000);
    const frameTimes = samples.map((s) => s.ms);
    const targetLine = samples.map(() => TARGET_60FPS_MS);
    return [timestamps, frameTimes, targetLine];
  }, [getFrameTimeSlice]);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;

    const opts: uPlot.Options = {
      width,
      height: CHART_HEIGHT,
      cursor: { show: true },
      scales: {
        x: { time: true },
        y: { auto: true, range: [0, 50] },
      },
      series: [
        {},
        {
          label: "Frame Time",
          stroke: COLORS.primary,
          width: 2,
          fill: "rgba(0, 255, 102, 0.08)",
        },
        {
          label: "60fps target",
          stroke: COLORS.muted,
          width: 1,
          dash: [4, 4],
        },
      ],
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
          label: "ms",
          labelFont: "11px 'Space Grotesk'",
          labelSize: 20,
        },
      ],
    };

    const data = buildData();
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update chart data when new frame-time arrives
  useEffect(() => {
    if (!chartRef.current || frameTimeMs === null) return;
    const data = buildData();
    chartRef.current.setData(data);
  }, [frameTimeMs, buildData]);

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
        Frame Time
      </h3>
      <div ref={containerRef} />
      {frameTimeMs === null && (
        <div className="py-8 text-center text-sm text-muted font-body">
          No frame-time data — start a game to begin monitoring
        </div>
      )}
    </div>
  );
}
