import { NavLink } from "react-router-dom";
import { useUiStore } from "../../stores/ui-store";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: "grid", enabled: true },
  { label: "AI Workload", path: "/ai-workload", icon: "cpu", enabled: true },
  { label: "Settings", path: "/settings", icon: "settings", enabled: true },
  { label: "Gaming Profile", path: "/gaming", icon: "gamepad", enabled: false, badge: "v0.2" },
  { label: "Analytics", path: "/analytics", icon: "chart", enabled: false, badge: "v0.2" },
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
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm transition-colors relative ${
                !item.enabled
                  ? "opacity-40 cursor-not-allowed"
                  : isActive
                    ? "text-primary border-l-4 border-primary"
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
            {expanded && item.badge && (
              <span className="ml-auto text-xs bg-surface-highest px-1.5 py-0.5 rounded font-display text-muted">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <div className="p-4 text-xs text-muted font-display">
        {expanded ? "v0.1.0" : "0.1"}
      </div>
    </nav>
  );
}

/** Simple icon placeholder — will be replaced with proper icons in design pass */
function NavIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    menu: "\u2630",
    grid: "\u25A6",
    cpu: "\u2699",
    settings: "\u2699",
    gamepad: "\u265F",
    chart: "\u2637",
  };
  return <span className="text-lg w-5 text-center">{icons[name] ?? "\u25CB"}</span>;
}
