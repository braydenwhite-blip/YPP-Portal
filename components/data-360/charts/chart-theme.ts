/**
 * Data 360 charts — shared theme tokens.
 *
 * Recharts is themed by hand to the YPP brand (`brand-600` #6b21c8) so charts
 * read as part of the design system, not a third-party widget. Two surfaces:
 * "dark" for the Data 360 terminal, "light" for entity pages / meetings / home.
 */

export type ChartTheme = "dark" | "light";

export type ChartSurface = {
  axis: string;
  grid: string;
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
};

export const CHART_SURFACES: Record<ChartTheme, ChartSurface> = {
  dark: {
    axis: "#5f6b80",
    grid: "rgba(255,255,255,0.06)",
    text: "#aeb6c6",
    tooltipBg: "#0f1420",
    tooltipBorder: "rgba(255,255,255,0.12)",
  },
  light: {
    axis: "#9aa2b1",
    grid: "rgba(15,20,32,0.06)",
    text: "#5b6472",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(15,20,32,0.12)",
  },
};

/** Brand-first categorical palette for multi-series charts (chapter lines etc.). */
export const SERIES_PALETTE = [
  "#8b3fe8", // brand
  "#5ec5ff", // sky
  "#34d399", // green
  "#fbbf24", // amber
  "#f87171", // red
  "#f472b6", // pink
  "#a78bfa", // violet
  "#22d3ee", // cyan
  "#facc15", // yellow
  "#4ade80", // lime
];

export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export const BRAND_LINE = "#8b3fe8";
