import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, chartMargins, CHART_COLORS, gridProps, tooltipStyle } from "./chartTheme.js";

/**
 * GrowthChart — dual-line fan growth chart (new registrations + cumulative).
 */
export default function GrowthChart({ series = [], loading = false }) {
  if (loading) return <div className="chart-loading">Loading…</div>;
  if (!series.length) return <p className="empty-state">No growth data.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={series} margin={chartMargins} style={{ background: "transparent" }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="date" tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Line
          type="monotone"
          dataKey="cumulativeTotal"
          name="Cumulative total"
          stroke={CHART_COLORS.primaryDark}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="newRegistrations"
          name="New registrations"
          stroke={CHART_COLORS.primaryLight}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
