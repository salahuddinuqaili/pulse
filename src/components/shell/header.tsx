import { useProfileStore } from "../../stores/profile-store";

export function Header() {
  const profile = useProfileStore((s) => s.activeProfile);

  return (
    <header className="h-12 flex items-center justify-between px-6 bg-surface shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-display text-lg font-semibold text-on-surface tracking-tight">
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
      <div className="text-xs text-muted font-display">
        {/* Compact mode toggle placeholder */}
      </div>
    </header>
  );
}
