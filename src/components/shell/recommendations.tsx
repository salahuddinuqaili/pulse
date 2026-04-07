import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useGpuStore } from "../../stores/gpu-store";
import { detectProfileMode } from "../../stores/profile-store";
import type { ProfileMode, Recommendation } from "../../lib/types";

const REFRESH_INTERVAL_MS = 10_000;

export function Recommendations() {
  const processes = useGpuStore((s) => s.current?.processes);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const mode: ProfileMode = detectProfileMode(processes);

  useEffect(() => {
    let cancelled = false;

    const fetchRecs = async () => {
      try {
        const result = await invoke<Recommendation[]>("get_recommendations");
        if (!cancelled) {
          setRecs(result);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to fetch recommendations:", e);
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecs();
    const id = setInterval(fetchRecs, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // Refetch immediately when the detected mode changes — picks up start/stop fast.
  }, [mode]);

  if (loading) {
    return (
      <p className="text-xs text-muted font-body">Analysing workload...</p>
    );
  }

  if (recs.length === 0) {
    return (
      <p className="text-xs text-muted font-body">No recommendations.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-display text-muted uppercase tracking-wider">
        Mode: {modeLabel(mode)}
      </div>
      {recs.map((r, i) => (
        <RecommendationCard key={`${r.category}-${i}`} rec={r} />
      ))}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const styles = categoryStyles(rec.category);

  return (
    <div className={`rounded-lg p-3 ${styles.bg}`}>
      <div className={`text-xs font-display ${styles.title}`}>{rec.title}</div>
      <div className="text-xs text-on-surface/80 font-body mt-1 leading-snug">
        {rec.description}
      </div>
    </div>
  );
}

function categoryStyles(category: Recommendation["category"]): {
  bg: string;
  title: string;
} {
  switch (category) {
    case "model_fit":
      return { bg: "bg-primary/10", title: "text-primary" };
    case "texture_budget":
      return { bg: "bg-primary/10", title: "text-primary" };
    case "warning":
      return { bg: "bg-warning/10", title: "text-warning" };
    case "optimization":
      return { bg: "bg-surface-elevate", title: "text-muted" };
  }
}

function modeLabel(mode: ProfileMode): string {
  switch (mode) {
    case "gaming":
      return "Gaming";
    case "ai":
      return "AI Workstation";
    case "gaming+ai":
      return "Gaming + AI";
    case "idle":
      return "Idle";
  }
}
