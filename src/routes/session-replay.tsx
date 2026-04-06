import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useSessionReplay } from "../hooks/use-session-replay";
import { useSessionStore } from "../stores/session-store";
import { ReplayChart } from "../components/replay/replay-chart";
import { ReplayTimeline } from "../components/replay/replay-timeline";
import { ReplayControls } from "../components/replay/replay-controls";
import { DeltaIndicators } from "../components/replay/delta-indicators";
import type { SessionMetadata } from "../lib/types";

export function SessionReplay() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sessions = useSessionStore((s) => s.sessions);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const [showGhostPicker, setShowGhostPicker] = useState(false);

  const {
    session,
    ghostSession,
    currentSnapshot,
    ghostSnapshot,
    currentIndex,
    isPlaying,
    playbackSpeed,
    isLoading,
    error,
    loadSession,
    loadGhost,
    clearGhost,
    seekTo,
    togglePlayback,
    setPlaybackSpeed,
  } = useSessionReplay();

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
    loadSessions();
  }, [sessionId, loadSession, loadSessions]);

  const sessionMeta = sessions.find((s) => s.id === sessionId);

  const handleExportMarkdown = () => {
    if (!sessionMeta) return;
    const agg = sessionMeta.aggregates;
    const lines = [
      "# Pulse Session Summary",
      `- **Game:** ${sessionMeta.game_detected ?? "N/A"}`,
      `- **Duration:** ${Math.round(((sessionMeta.end_ms ?? sessionMeta.start_ms) - sessionMeta.start_ms) / 60000)} min`,
      `- **Snapshots:** ${sessionMeta.snapshot_count}`,
    ];
    if (agg) {
      lines.push(
        `- **Avg Temp:** ${agg.avg_temp.toFixed(0)}C | **Max Temp:** ${agg.max_temp.toFixed(0)}C`,
        `- **Avg GPU Util:** ${agg.avg_gpu_util.toFixed(0)}%`,
        `- **Avg Power:** ${agg.avg_power_w.toFixed(0)}W`,
      );
      if (agg.avg_fps != null) {
        lines.push(`- **Avg FPS:** ${agg.avg_fps.toFixed(1)}`);
      }
    }
    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-session-${sessionId?.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      ".u-over + canvas, .uplot canvas"
    );
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-session-${sessionId?.slice(0, 8)}.png`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted font-body">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-warning font-display mb-2">
            Failed to load session
          </p>
          <p className="text-xs text-muted font-body">{error}</p>
        </div>
      </div>
    );
  }

  if (session.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted font-body">No session data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 overflow-y-auto h-full">
      {/* Session info bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-on-surface tracking-tight">
            {sessionMeta?.game_detected ?? "Session Replay"}
          </h1>
          <p className="text-xs text-muted font-body mt-1">
            {sessionMeta &&
              new Date(sessionMeta.start_ms).toLocaleString()}{" "}
            &middot; {sessionMeta?.snapshot_count} snapshots &middot;{" "}
            {sessionMeta?.gpu_name}
          </p>
        </div>
        <ReplayControls
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          hasGhost={ghostSession !== null}
          onTogglePlayback={togglePlayback}
          onSetSpeed={setPlaybackSpeed}
          onSelectGhost={() => setShowGhostPicker(true)}
          onClearGhost={clearGhost}
          onExportPng={handleExportPng}
          onExportMarkdown={handleExportMarkdown}
        />
      </div>

      {/* Ghost picker modal */}
      {showGhostPicker && (
        <GhostPicker
          sessions={sessions.filter((s) => s.id !== sessionId)}
          onSelect={(id) => {
            loadGhost(id);
            setShowGhostPicker(false);
          }}
          onClose={() => setShowGhostPicker(false)}
        />
      )}

      {/* Chart */}
      <ReplayChart
        session={session}
        ghostSession={ghostSession}
        currentIndex={currentIndex}
      />

      {/* Delta indicators */}
      {currentSnapshot && ghostSnapshot && (
        <DeltaIndicators current={currentSnapshot} ghost={ghostSnapshot} />
      )}

      {/* Timeline */}
      <ReplayTimeline
        totalFrames={session.length}
        currentIndex={currentIndex}
        ghostLength={ghostSession?.length ?? null}
        onSeek={seekTo}
      />
    </div>
  );
}

function GhostPicker({
  sessions,
  onSelect,
  onClose,
}: {
  sessions: SessionMetadata[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="bg-surface rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-display text-muted uppercase tracking-wider">
            Select Ghost Session
          </span>
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-on-surface"
          >
            Cancel
          </button>
        </div>
        <p className="text-sm text-muted font-body">
          No other sessions available for comparison
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-display text-muted uppercase tracking-wider">
          Select Ghost Session
        </span>
        <button
          onClick={onClose}
          className="text-xs text-muted hover:text-on-surface"
        >
          Cancel
        </button>
      </div>
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-surface-elevate transition-colors"
          >
            <div>
              <span className="text-sm font-display text-on-surface">
                {s.game_detected ?? "Unknown"}
              </span>
              <span className="text-xs text-muted font-body ml-2">
                {new Date(s.start_ms).toLocaleDateString()}
              </span>
            </div>
            <span className="text-xs text-muted font-display">
              {s.snapshot_count} snapshots
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
