import { NavLink } from "react-router-dom";
import { useUiStore } from "../../stores/ui-store";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: "dashboard", enabled: true },
  { label: "AI Workload", path: "/ai-workload", icon: "ai", enabled: true },
  { label: "Settings", path: "/settings", icon: "settings", enabled: true },
  { label: "Gaming Profile", path: "/gaming", icon: "gamepad", enabled: true },
  { label: "Analytics", path: "/analytics", icon: "chart", enabled: true },
];

export function LeftNav() {
  const expanded = useUiStore((s) => s.leftNavExpanded);
  const toggle = useUiStore((s) => s.toggleLeftNav);

  return (
    <nav
      className={`flex flex-col h-full bg-surface-low shrink-0 transition-all duration-200 ${
        expanded ? "w-[200px]" : "w-[60px]"
      }`}
    >
      <button
        onClick={toggle}
        className="p-4 text-muted hover:text-primary transition-colors"
        aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
      >
        <NavIcon name="menu" />
      </button>

      <div className="flex-1 flex flex-col gap-1 mt-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.enabled ? item.path : "#"}
            end={item.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm transition-all relative ${
                !item.enabled
                  ? "opacity-40 cursor-not-allowed"
                  : isActive
                    ? "text-primary border-l-4 border-primary shadow-[inset_4px_0_12px_rgba(0,255,102,0.3)]"
                    : "text-muted hover:text-on-surface border-l-4 border-transparent"
              }`
            }
            onClick={(e) => {
              if (!item.enabled) e.preventDefault();
            }}
          >
            <NavIcon name={item.icon} />
            {expanded && (
              <span className="font-display whitespace-nowrap">
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="p-4 text-xs text-muted font-display">
        {expanded ? "v0.2.0" : "0.2"}
      </div>
    </nav>
  );
}

function NavIcon({ name }: { name: string }) {
  const size = 18;
  const icons: Record<string, React.ReactNode> = {
    menu: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
    dashboard: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
    ai: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="4" y="4" width="16" height="16" rx="2" /><line x1="9" y1="9" x2="9" y2="15" /><line x1="15" y1="9" x2="15" y2="15" /><line x1="9" y1="12" x2="15" y2="12" />
      </svg>
    ),
    settings: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    gamepad: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="6" width="20" height="12" rx="3" /><line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><circle cx="15" cy="10" r="1" fill="currentColor" /><circle cx="17" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
    chart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  };
  return <span className="w-5 flex justify-center">{icons[name] ?? <span className="text-lg">{"\u25CB"}</span>}</span>;
}
