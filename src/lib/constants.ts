/** Design system color tokens — from DESIGN.md "The Kinetic Darkroom" */
export const COLORS = {
  primary: "#00FF66",
  background: "#0A0A0C",
  surface: "#141519",
  surfaceElevate: "#1D1E24",
  surfaceHighest: "#353437",
  text: "#F3F4F6",
  onSurface: "#e5e1e4",
  muted: "#8B909A",
  warning: "#FF3366",
  aiPurple: "#9333EA",
} as const;

/** Temperature thresholds (Celsius) */
export const TEMP_THRESHOLDS = {
  green: 70,
  yellow: 85,
} as const;

/** VRAM headroom thresholds (MB) */
export const HEADROOM_THRESHOLDS = {
  comfortable: 8192,  // 8 GB
  moderate: 4096,     // 4 GB
  limited: 2048,      // 2 GB
  critical: 512,      // 500 MB
} as const;

/** Known AI process names for frontend display classification */
export const KNOWN_AI_PROCESSES = [
  "ollama",
  "ollama_llama_server",
  "ollama_runner",
  "comfyui",
  "koboldcpp",
  "llama-server",
  "llama-cpp-server",
  "lm-studio",
  "stable-diffusion",
  "invoke-ai",
  "a1111",
  "vllm",
  "text-generation-launcher",
] as const;

/** Category colors for VRAM visualization */
export const CATEGORY_COLORS = {
  ai: "#9333EA",
  game: "#00FF66",
  system: "#353437",
  unknown: "#8B909A",
  free: "#0A0A0C",
} as const;

export const HEADROOM_LABELS = {
  comfortable: "Comfortable headroom — room for a 14B Q4 model or a demanding game",
  moderate: "Moderate headroom — a 7B Q4 model or a mid-range game would fit",
  limited: "Limited — only small models (3B) or lightweight games",
  tight: "Tight — additional workloads risk instability",
  critical: "Critical — VRAM nearly exhausted",
} as const;

export function getHeadroomLevel(freeVramMb: number) {
  if (freeVramMb >= HEADROOM_THRESHOLDS.comfortable) return "comfortable";
  if (freeVramMb >= HEADROOM_THRESHOLDS.moderate) return "moderate";
  if (freeVramMb >= HEADROOM_THRESHOLDS.limited) return "limited";
  if (freeVramMb >= HEADROOM_THRESHOLDS.critical) return "tight";
  return "critical";
}

export function getTemperatureColor(tempC: number): string {
  if (tempC < TEMP_THRESHOLDS.green) return COLORS.primary;
  if (tempC < TEMP_THRESHOLDS.yellow) return "#FBBF24"; // amber
  return COLORS.warning;
}
