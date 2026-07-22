/**
 * KpiCard — headline metric card with optional trend delta and tooltip.
 *
 * Props:
 *   icon       – lucide-react icon component
 *   label      – string
 *   value      – formatted display value
 *   delta      – number (% change) OR { value, pct, direction }
 *   color      – 'green' | 'blue' | 'orange' | 'purple' | 'red'  (optional)
 *   accent     – boolean  (green highlight)
 *   loading    – boolean
 *   tooltip    – string   ("?" hover text from kpiRegistry.description)
 *   onClick    – fn       (drill-down handler)
 */

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const COLOR_MAP = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", icon: "#16a34a" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", icon: "#2563eb" },
  orange: { bg: "#fff7ed", border: "#fed7aa", icon: "#f97316" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", icon: "#8b5cf6" },
  red:    { bg: "#fef2f2", border: "#fecaca", icon: "#ef4444" },
};

function normalizeDelta(delta) {
  if (delta == null) return null;
  if (typeof delta === "number") {
    return { pct: delta, direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
  }
  return delta;
}

export default function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  color,
  accent = false,
  loading = false,
  tooltip,
  onClick,
}) {
  const d = normalizeDelta(delta);
  const themeColor = COLOR_MAP[color];

  const cardStyle = themeColor ? {
    background: themeColor.bg,
    border: `1px solid ${themeColor.border}`,
    borderRadius: 10,
    padding: "14px 16px",
    minWidth: 140,
    flex: "1 1 140px",
    cursor: onClick ? "pointer" : "default",
  } : {};

  const iconStyle = themeColor ? { color: themeColor.icon } : {};

  const deltaColor = d?.direction === "up" ? "#16a34a" : d?.direction === "down" ? "#dc2626" : "#6b7280";

  return (
    <div
      style={cardStyle}
      className={`kpi-card${accent ? " kpi-card--accent" : ""}${onClick ? " kpi-card--clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="kpi-card__top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        {Icon && (
          <span className="kpi-card__icon" style={iconStyle}>
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
        {tooltip && (
          <span
            className="kpi-card__tooltip"
            title={tooltip}
            style={{ fontSize: 11, color: "#9ca3af", cursor: "help", border: "1px solid #e5e7eb", borderRadius: "50%", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >?</span>
        )}
      </div>
      <div className="kpi-card__value" style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 2 }}>
        {loading ? "—" : value}
      </div>
      <div className="kpi-card__label" style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      {d && !loading && (
        <div style={{ fontSize: 12, color: deltaColor, marginTop: 4, fontWeight: 500, display: "flex", alignItems: "center", gap: 3 }}>
          {d.direction === "up"   && <TrendingUp  size={12} strokeWidth={2.5} />}
          {d.direction === "down" && <TrendingDown size={12} strokeWidth={2.5} />}
          {d.direction === "flat" && <Minus        size={12} strokeWidth={2.5} />}
          {d.pct  != null ? `${Math.abs(d.pct).toFixed(1)}%` : ""}
          {d.value != null && d.pct == null ? ` ${d.value > 0 ? "+" : ""}${d.value.toLocaleString()}` : ""}
        </div>
      )}
    </div>
  );
}
