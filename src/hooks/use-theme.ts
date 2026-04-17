import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const THEME_CLASSES = ["theme-neon-max", "theme-system"] as const;

export function applyTheme(theme: string) {
  const root = document.documentElement;
  THEME_CLASSES.forEach((cls) => root.classList.remove(cls));
  if (theme === "Neon-Max") root.classList.add("theme-neon-max");
  else if (theme === "System") root.classList.add("theme-system");
  // "Dark" = base CSS, no extra class needed
}

export function useTheme() {
  useEffect(() => {
    invoke<{ theme: string }>("get_settings")
      .then((s) => applyTheme(s.theme))
      .catch(() => {});
  }, []);
}
