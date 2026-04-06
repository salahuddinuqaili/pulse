import { invoke } from "@tauri-apps/api/core";
import { useProfileStore } from "../../stores/profile-store";
import { SessionControls } from "../shared/session-controls";

export function Header() {
  const profile = useProfileStore((s) => s.activeProfile);

  const toggleOverlay = () => {
    invoke("toggle_compact_overlay").catch(console.error);
  };

  return (
    <header className="h-12 flex items-center justify-between px-6 bg-surface shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-display text-lg font-semibold text-primary tracking-tight">
          Pulse
        </span>
        <span className="flex items-center gap-1.5 bg-surface-elevate px-3 py-1 rounded-full text-xs font-display">
          <span
            className={`w-2 h-2 rounded-full ${
              profile === "gaming" ? "bg-primary" : "bg-[#9333EA]"
            }`}
          />
          <span className="text-on-surface uppercase tracking-wider">
            {profile === "gaming" ? "Gaming Profile" : "AI Workload"}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <SessionControls />
      <button
        onClick={toggleOverlay}
        className="flex items-center gap-2 text-xs text-muted font-display hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-elevate"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        Compact Mode
      </button>
      </div>
    </header>
  );
}
