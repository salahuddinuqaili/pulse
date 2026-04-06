import { useNavigate } from "react-router-dom";
import type { SessionMetadata } from "../../lib/types";

interface SessionListProps {
  sessions: SessionMetadata[];
  onDelete: (id: string) => void;
}

export function SessionList({ sessions, onDelete }: SessionListProps) {
  const navigate = useNavigate();

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-elevate rounded-xl p-4">
      <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
        Recent Sessions
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted font-display uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">Date</th>
              <th className="text-left pb-2 pr-4">Game</th>
              <th className="text-right pb-2 pr-4">Duration</th>
              <th className="text-right pb-2 pr-4">Avg Temp</th>
              <th className="text-right pb-2 pr-4">Avg FPS</th>
              <th className="text-right pb-2" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const durationMin = session.end_ms
                ? Math.round(
                    (session.end_ms - session.start_ms) / 60000
                  )
                : 0;
              return (
                <tr
                  key={session.id}
                  className="hover:bg-surface transition-colors cursor-pointer"
                  onClick={() => navigate(`/replay/${session.id}`)}
                >
                  <td className="py-2 pr-4 font-body text-on-surface">
                    {new Date(session.start_ms).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4 font-body text-on-surface">
                    {session.game_detected ?? "\u2014"}
                  </td>
                  <td className="py-2 pr-4 font-display text-on-surface text-right">
                    {durationMin}m
                  </td>
                  <td className="py-2 pr-4 font-display text-on-surface text-right">
                    {session.aggregates?.avg_temp.toFixed(0) ?? "\u2014"}&deg;C
                  </td>
                  <td className="py-2 pr-4 font-display text-on-surface text-right">
                    {session.aggregates?.avg_fps?.toFixed(0) ?? "\u2014"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="text-xs text-muted hover:text-warning transition-colors px-2 py-1 rounded hover:bg-surface"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
