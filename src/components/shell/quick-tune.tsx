import { useProfileStore } from "../../stores/profile-store";
import { useUiStore } from "../../stores/ui-store";
import { useGpuStore } from "../../stores/gpu-store";
import { Recommendations } from "./recommendations";

export function QuickTune() {
  const expanded = useUiStore((s) => s.rightSidebarExpanded);
  const toggle = useUiStore((s) => s.toggleRightSidebar);
  const profile = useProfileStore((s) => s.activeProfile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const nvmlError = useGpuStore((s) => s.nvmlError);

  return (
    <aside
      className={`flex flex-col h-full bg-surface-low shrink-0 transition-all duration-200 ${
        expanded ? "w-[240px]" : "w-[60px]"
      }`}
    >
      <button
        onClick={toggle}
        className="p-4 text-muted hover:text-primary transition-colors self-end"
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        {expanded ? "\u276E" : "\u276F"}
      </button>

      {expanded && (
        <div className="px-4 flex flex-col gap-6">
          <div>
            <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
              Monitoring Profile
            </h3>
            <div className="flex flex-col gap-2">
              <ProfileButton
                label="Gaming View"
                active={profile === "gaming"}
                onClick={() => setProfile("gaming")}
              />
              <ProfileButton
                label="AI View"
                active={profile === "ai"}
                onClick={() => setProfile("ai")}
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
              System Status
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  nvmlError ? "bg-warning" : "bg-primary"
                }`}
              />
              <span className="text-on-surface font-body">
                {nvmlError ? "NVML Disconnected" : "NVML Connected"}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
              Recommendations
            </h3>
            <Recommendations />
          </div>
        </div>
      )}
    </aside>
  );
}

function ProfileButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-display transition-all ${
        active
          ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,255,102,0.2)]"
          : "text-muted hover:text-on-surface hover:bg-surface-elevate"
      }`}
    >
      {label}
    </button>
  );
}
