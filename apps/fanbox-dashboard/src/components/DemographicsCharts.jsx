import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartPanel from "./ChartPanel.jsx";
import {
  CHART_COLORS,
  axisTick,
  chartMargins,
  formatChartNumber,
  gridProps,
  tooltipStyle,
} from "../lib/chartTheme.js";

const CHARTS = [
  { key: "byCity", title: "Top cities", description: "Fans by city (top 10)", horizontal: true },
  { key: "byState", title: "States", description: "Fans by state or region", horizontal: true },
  { key: "byGender", title: "Gender", description: "Gender distribution" },
  { key: "byAgeBand", title: "Age bands", description: "Age group breakdown" },
  { key: "hasChildren", title: "Has children", description: "Household composition" },
  { key: "incomeBand", title: "Income bands", description: "Reported income ranges" },
];

const BAR_SHADES = [CHART_COLORS.primary, CHART_COLORS.primaryLight, CHART_COLORS.primaryDark, "#6ba84a", "#a3d977"];

function DemographicBarChart({ rows, horizontal }) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ ...chartMargins, left: 8 }}>
          <CartesianGrid {...gridProps} horizontal={false} />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} />
          <YAxis
            type="category"
            dataKey="value"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
            width={88}
          />
          <Tooltip {...tooltipStyle} formatter={(value) => formatChartNumber(value)} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BAR_SHADES[index % BAR_SHADES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={chartMargins}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="value" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} width={40} />
        <Tooltip {...tooltipStyle} formatter={(value) => formatChartNumber(value)} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {rows.map((_, index) => (
            <Cell key={`cell-${index}`} fill={BAR_SHADES[index % BAR_SHADES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DemographicsCharts({ demographics }) {
  return (
    <div className="demographics-grid">
      {CHARTS.map((chart) => {
        const rows = (demographics?.[chart.key] ?? []).slice(0, 10);
        return (
          <ChartPanel key={chart.key} title={chart.title} description={chart.description}>
            {!rows.length ? (
              <p className="empty-state">No data available.</p>
            ) : (
              <div className={`chart-wrap${chart.horizontal ? " chart-wrap--horizontal" : ""}`}>
                <DemographicBarChart rows={rows} horizontal={chart.horizontal} />
              </div>
            )}
          </ChartPanel>
        );
      })}
    </div>
  );
}
