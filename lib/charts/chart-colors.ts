/** Terminal-aesthetic chart color palette */
export const CHART_COLORS = {
  green: {
    primary: "#39d353",
    muted: "#26a641",
    dark: "#0e4429",
    light: "#9be9a8",
  },
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
} as const;

/** Model color assignments for stacked charts */
export const MODEL_COLORS = [
  "#39d353", // green
  "#58a6ff", // blue
  "#f0883e", // orange
  "#bc8cff", // purple
  "#f778ba", // pink
  "#79c0ff", // light blue
  "#ffd33d", // yellow
  "#56d364", // light green
  "#ff7b72", // red
  "#d2a8ff", // lavender
] as const;

/** Get a stable color for a model name */
export function getModelColor(model: string, index: number): string {
  return MODEL_COLORS[index % MODEL_COLORS.length];
}
