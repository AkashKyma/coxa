/**
 * ChartKit — registry-driven chart renderer.
 * Renders the appropriate chart based on `vizType` from kpiRegistry defaultViz.
 *
 * Supported vizTypes:
 *   kpi_card, bar, stacked_bar, grouped_bar, horizontal_bar, line, area,
 *   pie, donut, gauge, heatmap, treemap, funnel, combo, sparkline
 */

import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  RadialBarChart, RadialBar,
  Treemap,
  FunnelChart, Funnel, LabelList,
  ComposedChart,
} from "recharts";
import {
  CHART_COLORS, axisTick, chartMargins,
  gridProps, tooltipStyle, formatChartNumber,
} from "./chartTheme.js";

// ── Palette helpers ───────────────────────────────────────────────────────────
const PALETTE = [
  "#16a34a", "#2563eb", "#f97316", "#8b5cf6", "#ef4444",
  "#06b6d4", "#84cc16", "#f59e0b", "#ec4899", "#64748b",
];
function color(i) { return PALETTE[i % PALETTE.length]; }

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCardViz({ value, label, delta }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#111" }}>{value}</div>
      {label && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{label}</div>}
      {delta != null && (
        <div style={{ fontSize: 13, color: delta >= 0 ? "#16a34a" : "#dc2626", marginTop: 4 }}>
          {delta > 0 ? "+" : ""}{delta}%
        </div>
      )}
    </div>
  );
}

// ── Bar ───────────────────────────────────────────────────────────────────────
function BarViz({ data = [], dataKey = "value", nameKey = "name", horizontal = false, stacked = false, series, color: singleColor }) {
  const isMultiSeries = Array.isArray(series) && series.length > 0;
  const layout = horizontal ? "vertical" : "horizontal";

  let xAxisEl;
  let yAxisEl;
  if (horizontal) {
    xAxisEl = <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} />;
    yAxisEl = <YAxis dataKey={nameKey} type="category" tick={axisTick} width={90} tickLine={false} />;
  } else {
    xAxisEl = <XAxis dataKey={nameKey} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />;
    yAxisEl = <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} width={40} />;
  }

  let barsEl;
  if (isMultiSeries) {
    const seriesBars = series.map((s, i) => (
      <Bar
        key={s.key}
        dataKey={s.key}
        name={s.label}
        fill={s.color ?? color(i)}
        radius={[4, 4, 0, 0]}
        stackId={stacked ? "s" : undefined}
        maxBarSize={48}
      />
    ));
    barsEl = [<Legend key="legend" />, ...seriesBars];
  } else {
    barsEl = (
      <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={48}>
        {data.map((_, i) => <Cell key={i} fill={singleColor ?? color(i)} />)}
      </Bar>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={chartMargins} layout={layout} style={{ background: "transparent" }}>
        <CartesianGrid {...gridProps} />
        {xAxisEl}
        {yAxisEl}
        <Tooltip {...tooltipStyle} formatter={(v) => formatChartNumber(v)} />
        {barsEl}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Line ──────────────────────────────────────────────────────────────────────
function LineViz({ data = [], dataKey = "value", nameKey = "name", series }) {
  const isMultiSeries = Array.isArray(series) && series.length > 0;

  let linesEl;
  if (isMultiSeries) {
    const seriesLines = series.map((s, i) => (
      <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color(i)} strokeWidth={2} dot={false} />
    ));
    linesEl = [<Legend key="legend" />, ...seriesLines];
  } else {
    linesEl = <Line type="monotone" dataKey={dataKey} stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={chartMargins} style={{ background: "transparent" }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={nameKey} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} width={40} />
        <Tooltip {...tooltipStyle} />
        {linesEl}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Area ──────────────────────────────────────────────────────────────────────
function AreaViz({ data = [], dataKey = "value", nameKey = "name" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={chartMargins} style={{ background: "transparent" }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={nameKey} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} width={40} />
        <Tooltip {...tooltipStyle} />
        <Area type="monotone" dataKey={dataKey} stroke={CHART_COLORS.primary} fill={CHART_COLORS.primaryLight} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Pie / Donut ────────────────────────────────────────────────────────────────
function PieViz({ data = [], dataKey = "value", nameKey = "name", donut = false }) {
  const innerRadius = donut ? "55%" : 0;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart style={{ background: "transparent" }}>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius="80%" innerRadius={innerRadius} label>
          {data.map((_, i) => <Cell key={i} fill={color(i)} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Gauge (RadialBar with single value) ───────────────────────────────────────
function GaugeViz({ value = 0, max = 100, label }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const gaugeData = [{ name: label ?? "Value", value: pct }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="70%" outerRadius="90%" data={gaugeData} startAngle={180} endAngle={0}>
        <RadialBar dataKey="value" cornerRadius={8} fill={CHART_COLORS.primary} background={{ fill: CHART_COLORS.grid }} />
        <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 22, fontWeight: 700 }}>
          {pct.toFixed(1)}%
        </text>
        {label && (
          <text x="50%" y="70%" textAnchor="middle" style={{ fontSize: 12, fill: "#6b7280" }}>{label}</text>
        )}
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

// ── Heatmap (hour × DOW grid) ─────────────────────────────────────────────────
function HeatmapViz({ data = [], xKey = "hour", yKey = "dow", valueKey = "value" }) {
  const vals = data.map((d) => d[valueKey] ?? 0);
  const maxVal = Math.max(...vals, 1);
  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const map = {};
  data.forEach((d) => {
    map[`${d[xKey]}-${d[yKey]}`] = d[valueKey] ?? 0;
  });

  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: "2px 4px" }} />
            {HOURS.map((h) => (
              <th key={h} style={{ padding: "2px 3px", textAlign: "center", fontSize: 10, color: "#6b7280" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOW_LABELS.map((d, di) => (
            <tr key={d}>
              <td style={{ padding: "2px 6px", color: "#6b7280", fontSize: 11 }}>{d}</td>
              {HOURS.map((h) => {
                const v = map[`${h}-${di}`] ?? 0;
                const alpha = (v / maxVal).toFixed(2);
                const bg = `rgba(22,163,74,${alpha})`;
                return (
                  <td
                    key={h}
                    title={`${d} ${h}:00 — ${v}`}
                    style={{ width: 18, height: 18, background: bg, border: "1px solid #f0f0f0" }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Treemap ────────────────────────────────────────────────────────────────────
function TreemapViz({ data = [], dataKey = "value", nameKey = "name" }) {
  function renderTreemapContent({ x, y, width, height, name }) {
    if (width < 30 || height < 20) return null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} style={{ fill: CHART_COLORS.primary, stroke: "#fff", strokeWidth: 2 }} />
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "#fff" }}>
          {name}
        </text>
      </g>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap data={data} dataKey={dataKey} nameKey={nameKey} aspectRatio={4 / 3} stroke="#fff" fill={CHART_COLORS.primary} content={renderTreemapContent} />
    </ResponsiveContainer>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function FunnelViz({ data = [], dataKey = "value", nameKey = "name" }) {
  const enriched = data.map((d, i) => ({ ...d, fill: color(i) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart>
        <Tooltip {...tooltipStyle} />
        <Funnel dataKey={dataKey} data={enriched} isAnimationActive>
          <LabelList position="center" fill="#fff" stroke="none" dataKey={nameKey} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function SparklineViz({ data = [], dataKey = "value" }) {
  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Line type="monotone" dataKey={dataKey} stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Combo (Bar + Line) ────────────────────────────────────────────────────────
function ComboViz({ data = [], barKey = "value", lineKey = "trend", nameKey = "name" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={chartMargins} style={{ background: "transparent" }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={nameKey} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatChartNumber} width={40} />
        <Tooltip {...tooltipStyle} />
        <Legend />
        <Bar dataKey={barKey} fill={CHART_COLORS.primaryLight} radius={[4, 4, 0, 0]} maxBarSize={48} />
        <Line type="monotone" dataKey={lineKey} stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Main ChartKit component ───────────────────────────────────────────────────
// Accepts both `vizType` (registry-driven) and `type` (inline shorthand) so callers
// can write <ChartKit type="bar" data={...} dataKey="value" xKey="name" color="#6366f1" height={200} />
export default function ChartKit({
  // canonical prop
  vizType,
  // shorthand aliases used by inline callers
  type,
  data = [],
  config = {},
  value, label, delta,
  // passthrough convenience props that go into config
  dataKey, xKey, color, height, series,
  nameKey,
}) {
  const resolvedType = vizType ?? type ?? "bar";

  // Merge convenience props into config so sub-components receive them
  const mergedConfig = {
    ...(dataKey   !== undefined && { dataKey }),
    ...(xKey      !== undefined && { nameKey: xKey }),
    ...(nameKey   !== undefined && { nameKey }),
    ...(color     !== undefined && { color }),
    ...(series    !== undefined && { series }),
    ...config,
  };

  // If a height prop is given, wrap in a sized div — otherwise render bare (parent sizes it)
  const inner = (() => {
    switch (resolvedType) {
      case "kpi_card":      return <KpiCardViz value={value} label={label} delta={delta} />;
      case "bar":           return <BarViz data={data} {...mergedConfig} />;
      case "stacked_bar":   return <BarViz data={data} stacked {...mergedConfig} />;
      case "grouped_bar":   return <BarViz data={data} {...mergedConfig} />;
      case "horizontal_bar":return <BarViz data={data} horizontal {...mergedConfig} />;
      case "line":          return <LineViz data={data} {...mergedConfig} />;
      case "area":          return <AreaViz data={data} {...mergedConfig} />;
      case "pie":           return <PieViz data={data} {...mergedConfig} />;
      case "donut":         return <PieViz data={data} donut {...mergedConfig} />;
      case "gauge":         return <GaugeViz value={value ?? mergedConfig.value} max={mergedConfig.max ?? 100} label={label} />;
      case "heatmap":       return <HeatmapViz data={data} {...mergedConfig} />;
      case "treemap":       return <TreemapViz data={data} {...mergedConfig} />;
      case "funnel":        return <FunnelViz data={data} {...mergedConfig} />;
      case "sparkline":     return <SparklineViz data={data} {...mergedConfig} />;
      case "combo":         return <ComboViz data={data} {...mergedConfig} />;
      default:              return <BarViz data={data} {...mergedConfig} />;
    }
  })();

  if (height) {
    return (
      <div style={{ width: "100%", height, background: "transparent" }}>
        {inner}
      </div>
    );
  }
  return inner;
}
