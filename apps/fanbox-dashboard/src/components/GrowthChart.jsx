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
import ChartPanel from "./ChartPanel.jsx";
import {
  CHART_COLORS,
  axisTick,
  chartMargins,
  formatChartNumber,
  gridProps,
  tooltipStyle,
} from "../lib/chartTheme.js";

export default function GrowthChart({ data = [], title = "Fan growth", description, granularity = "month" }) {
  const periodLabel = granularity === "week" ? "Weekly" : "Monthly";

  return (
    <ChartPanel
      title={title}
      description={description ?? `${periodLabel} new registrations and cumulative fan base.`}
    >
      {!data.length ? (
        <p className="empty-state">No growth data for this range.</p>
      ) : (
        <div className="chart-wrap chart-wrap--tall">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={chartMargins}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} width={48} />
              <Tooltip {...tooltipStyle} formatter={(value) => formatChartNumber(value)} />
              <Legend wrapperStyle={{ paddingTop: 12 }} />
              <Line
                type="monotone"
                dataKey="newRegistrations"
                name="New registrations"
                stroke={CHART_COLORS.primaryLight}
                strokeWidth={2.5}
                dot={{ r: 3, fill: CHART_COLORS.primaryLight }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="cumulativeTotal"
                name="Cumulative total"
                stroke={CHART_COLORS.primaryDark}
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
}
