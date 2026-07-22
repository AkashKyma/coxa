import { useState } from "react";

function toInputDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Today", key: "today" },
  { label: "7 d", key: "7d" },
  { label: "30 d", key: "30d" },
  { label: "MTD", key: "mtd" },
  { label: "QTD", key: "qtd" },
  { label: "YTD", key: "ytd" },
];

function resolvePreset(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.toISOString().slice(0, 10);
  if (key === "today") return { from: today, to: today, preset: key };
  if (key === "7d") {
    const d = new Date(now); d.setDate(d.getDate() - 7);
    return { from: d.toISOString().slice(0, 10), to: today, preset: key };
  }
  if (key === "30d") {
    const d = new Date(now); d.setDate(d.getDate() - 30);
    return { from: d.toISOString().slice(0, 10), to: today, preset: key };
  }
  if (key === "mtd") return { from: `${y}-${String(m + 1).padStart(2, "0")}-01`, to: today, preset: key };
  if (key === "qtd") {
    const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
    return { from: qStart.toISOString().slice(0, 10), to: today, preset: key };
  }
  if (key === "ytd") return { from: `${y}-01-01`, to: today, preset: key };
  return {};
}

const GRANULARITIES = ["day", "week", "month", "quarter", "year"];

/**
 * DateRangeFilter
 *
 * Props:
 *   value           – { from?, to?, granularity?, preset? }
 *   onChange        – fn({ from, to, granularity?, preset? })
 *   showPresets     – boolean (default true)
 *   showGranularity – boolean (default false)
 *   granularity     – controlled granularity string
 *   onGranularityChange – fn(string) — alternative granularity handler
 */
export default function DateRangeFilter({
  value = {},
  onChange,
  showPresets = true,
  showGranularity = false,
  granularity: controlledGranularity,
  onGranularityChange,
}) {
  const [from, setFrom] = useState(toInputDate(value?.from));
  const [to, setTo] = useState(toInputDate(value?.to));
  const [activePreset, setActivePreset] = useState(value?.preset ?? null);
  const [gran, setGran] = useState(controlledGranularity ?? value?.granularity ?? "month");

  function emitChange(overrides = {}) {
    onChange?.({ from: from || undefined, to: to || undefined, granularity: gran, ...overrides });
  }

  function apply() {
    setActivePreset(null);
    emitChange({ preset: undefined });
  }

  function clearRange() {
    setFrom(""); setTo(""); setActivePreset(null);
    onChange?.({ granularity: gran });
  }

  function applyPreset(key) {
    const range = resolvePreset(key);
    setFrom(range.from ?? ""); setTo(range.to ?? "");
    setActivePreset(key);
    onChange?.({ ...range, granularity: gran });
  }

  function handleGranChange(g) {
    setGran(g);
    onGranularityChange?.(g);
    emitChange({ granularity: g });
  }

  return (
    <div className="date-range-filter" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {showPresets && (
        <div className="date-range-filter__presets" style={{ display: "flex", gap: 4 }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`btn btn--xs${activePreset === p.key ? " btn--primary" : " btn--ghost"}`}
              onClick={() => applyPreset(p.key)}
              style={{ fontSize: 12, padding: "3px 8px" }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <label className="date-range-filter__field" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
        <span style={{ color: "#6b7280" }}>From</span>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} style={{ fontSize: 13 }} />
      </label>
      <label className="date-range-filter__field" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
        <span style={{ color: "#6b7280" }}>To</span>
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} style={{ fontSize: 13 }} />
      </label>
      <button type="button" className="btn btn--primary btn--sm" onClick={apply}>Apply</button>
      <button type="button" className="btn btn--ghost btn--sm" onClick={clearRange}>Clear</button>
      {showGranularity && (
        <select
          className="input input--sm"
          value={gran}
          onChange={(e) => handleGranChange(e.target.value)}
          style={{ fontSize: 13 }}
        >
          {GRANULARITIES.map((g) => (
            <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
          ))}
        </select>
      )}
    </div>
  );
}
