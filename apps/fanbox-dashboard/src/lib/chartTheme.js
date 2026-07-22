/** Shared Recharts styling aligned with @coxa/ui tokens */
export const CHART_COLORS = {
  primary: "#4d8b31",
  primaryLight: "#86c56a",
  primaryDark: "#3a6b25",
  secondary: "#1e212b",
  accent: "#ffc800",
  grid: "#e8ebf0",
  axis: "#5c6370",
  tooltipBg: "#ffffff",
  tooltipBorder: "#dde1e8",
};

export const chartMargins = { top: 12, right: 20, left: 4, bottom: 4 };

export const axisTick = { fill: CHART_COLORS.axis, fontSize: 12 };

export const gridProps = {
  strokeDasharray: "4 4",
  stroke: CHART_COLORS.grid,
  vertical: false,
};

export function formatChartNumber(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US");
}

export const tooltipStyle = {
  contentStyle: {
    background: CHART_COLORS.tooltipBg,
    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: 13,
  },
  labelStyle: { color: CHART_COLORS.secondary, fontWeight: 600 },
  itemStyle: { color: CHART_COLORS.axis },
};
