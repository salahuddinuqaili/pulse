import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { SessionMetadata } from "../lib/types";
import {
  TimeRangeTabs,
  getTimeRangeMs,
  type TimeRange,
} from "../components/analytics/time-range-tabs";
import { MultiMetricChart } from "../components/analytics/multi-metric-chart";
import { SessionList } from "../components/analytics/session-list";

export function Analytics() {
  const [range, setRange] = useState<TimeRange>("1D");
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [timeRange, setTimeRange] = useState(() => getTimeRangeMs("1D"));

  const loadSessions = useCallback(async (tr: TimeRange) => {
    const { start, end } = getTimeRangeMs(tr);
    setTimeRange({ start, end });
    try {
      const result = await invoke<SessionMetadata[]>(
        "list_sessions_in_range",
        { startMs: start, endMs: end }
      );
      setSessions(result);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  }, []);

  useEffect(() => {
    loadSessions(range);
  }, [range, loadSessions]);

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_session", { sessionId: id });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-on-surface tracking-tight">
          Hardware Analytics
        </h1>
        <TimeRangeTabs selected={range} onChange={setRange} />
      </div>

      <MultiMetricChart sessions={sessions} timeRangeStart={timeRange.start} timeRangeEnd={timeRange.end} />
      <SessionList sessions={sessions} onDelete={handleDelete} />
    </div>
  );
}
