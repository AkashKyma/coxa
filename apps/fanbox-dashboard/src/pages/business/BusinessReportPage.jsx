/**
 * BusinessReportPage — per-source KPI report.
 *
 * Retail sources (stores, ecommerce, coxa-foods):
 *   • Per-store KPI cards + per-store revenue bars
 *   • Category breakdown (pie/bar)
 *   • Hour-of-day & Day-of-week heatmaps
 *   • Top products table
 *
 * Non-retail sources (membership, tickets, access, loyalty, …):
 *   • KPI stat cards with period-over-period delta
 *   • Single bar chart of numeric KPIs
 *   • Detail DataTable
 */

import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Store, Package, Clock, CalendarDays, BarChart2,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
} from "lucide-react";
import { fanboxApi } from "../../lib/api.js";
import { DataTable, KpiCard, ChartKit } from "@coxa/ui-analytics";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(cents) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtNum(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR");
}
function fmtPct(n) {
  if (n == null) return "—";
  return `${Number(n).toFixed(1)}%`;
}
function fmtKpi(key, value) {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  const k = key ?? "";
  if (k.endsWith("_cents") || k.includes("revenue") || k.includes("arpu") || k.includes("value_cents")) return fmtBRL(value);
  if (k.endsWith("_pct") || k.includes("rate") || k === "ticketUseRatePct" || k === "noShowRatePct") return fmtPct(value);
  return fmtNum(value);
}
function prettify(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
function makeDelta(deltaValue) {
  if (deltaValue == null) return undefined;
  return { value: deltaValue, pct: deltaValue, direction: deltaValue >= 0 ? "up" : "down" };
}

const RETAIL_SOURCES = new Set(["stores", "ecommerce", "coxa-foods"]);

// ─── sub-component: single store card ────────────────────────────────────────

function StoreCard({ loc, rank, total }) {
  const share = total > 0 ? (loc.revenueCents / total) * 100 : 0;
  const colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];
  const color = colors[(rank - 1) % colors.length];

  return (
    <div style={{
      border: `1.5px solid ${color}33`,
      borderRadius: 12,
      padding: "16px 18px",
      background: `${color}06`,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8,
          background: color, color: "#fff",
          fontSize: 12, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>#{rank}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{loc.locationName}</span>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Revenue</div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{fmtBRL(loc.revenueCents)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Orders</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#334155" }}>{fmtNum(loc.orders)}</div>
        </div>
      </div>

      {/* Revenue share bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
          <span>Revenue share</span>
          <span style={{ fontWeight: 600, color }}>{share.toFixed(1)}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 10, background: "#e2e8f0" }}>
          <div style={{ width: `${share}%`, height: "100%", borderRadius: 10, background: color, transition: "width 0.4s" }} />
        </div>
      </div>

      {/* AOV */}
      {loc.orders > 0 && (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Avg order: <strong>{fmtBRL(Math.round(loc.revenueCents / loc.orders))}</strong>
        </div>
      )}
    </div>
  );
}

// ─── Retail view ─────────────────────────────────────────────────────────────

function RetailView({ source, range, storeId }) {
  const channelMap = { stores: "pos", ecommerce: "fan_shop", "coxa-foods": "pos" };
  const channel = channelMap[source] ?? "pos";

  const [summary, setSummary]     = useState(null);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = {};
    if (range?.from)   params.from    = range.from;
    if (range?.to)     params.to      = range.to;
    if (range?.preset) params.preset  = range.preset;
    params.channel = channel;

    try {
      const [sumRes, prodRes] = await Promise.all([
        fanboxApi.retailSummary(params),
        fanboxApi.retailTopProducts({ ...params, limit: 10 }),
      ]);
      setSummary(sumRes.data ?? sumRes);
      setProducts(prodRes.data ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [channel, range?.from, range?.to, range?.preset]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="placeholder-card">Loading…</div>;
  if (error)   return <p className="form-error">{error}</p>;
  if (!summary) return null;

  const { kpis, previousPeriod: prev, byLocation, byCategory, byHour, byDayOfWeek } = summary;

  // Filter by storeId if a specific store is selected
  const filteredLocations = (storeId && storeId !== "all")
    ? (byLocation ?? []).filter((l) => String(l.locationId) === String(storeId) || l.locationName === storeId)
    : (byLocation ?? []);

  const totalRevenue = filteredLocations.reduce((s, l) => s + l.revenueCents, 0) || kpis?.revenueCents || 0;

  // Summary KPI cards
  const summaryKpis = [
    { key: "orders",              label: "Total Orders",     value: fmtNum(kpis?.orders),            delta: makeDelta(prev?.ordersDeltaPct) },
    { key: "revenueCents",        label: "Total Revenue",    value: fmtBRL(kpis?.revenueCents),      delta: makeDelta(prev?.revenueDeltaPct) },
    { key: "uniqueBuyers",        label: "Unique Buyers",    value: fmtNum(kpis?.uniqueBuyers) },
    { key: "avgOrderValueCents",  label: "Avg Order Value",  value: fmtBRL(kpis?.avgOrderValueCents) },
    { key: "totalItems",          label: "Items Sold",       value: fmtNum(kpis?.totalItems) },
    { key: "avgItemsPerOrder",    label: "Items / Order",    value: kpis?.avgItemsPerOrder != null ? Number(kpis.avgItemsPerOrder).toFixed(1) : "—" },
  ];

  // Chart data
  const locationChartData = filteredLocations.map((l) => ({
    name: l.locationName,
    revenue: l.revenueCents / 100,
    orders: l.orders,
  }));

  const categoryChartData = (byCategory ?? []).slice(0, 8).map((c) => ({
    name: c.categoryName ?? "Other",
    value: c.revenueCents / 100,
  }));

  const hourChartData = (byHour ?? []).map((h) => ({ name: h.label, value: h.revenueCents / 100 }));
  const dowChartData  = (byDayOfWeek ?? []).map((d) => ({ name: d.label, value: d.revenueCents / 100 }));

  return (
    <div>
      {/* ── Summary KPI cards ─────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        {summaryKpis.map((k) => (
          <KpiCard key={k.key} label={k.label} value={k.value} delta={k.delta} />
        ))}
      </div>

      {/* ── Per-store breakdown ────────────────────────── */}
      {filteredLocations.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <Store size={15} color="#6366f1" strokeWidth={2} />
            Store Performance {storeId !== "all" && "— filtered"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
            {filteredLocations.map((loc, i) => (
              <StoreCard key={loc.locationId ?? i} loc={loc} rank={i + 1} total={totalRevenue} />
            ))}
          </div>

          {/* Store revenue comparison chart */}
          {locationChartData.length >= 2 && (
            <ChartKit
              type="bar"
              data={locationChartData}
              series={[
                { key: "revenue", label: "Revenue (R$)", color: "#6366f1" },
                { key: "orders",  label: "Orders",       color: "#0ea5e9" },
              ]}
              xKey="name"
              height={220}
            />
          )}
        </section>
      )}

      {/* ── Category breakdown ─────────────────────────── */}
      {categoryChartData.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <Package size={15} color="#10b981" strokeWidth={2} />
            Revenue by Category
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ChartKit type="pie" data={categoryChartData} dataKey="value" height={200} />
            <ChartKit type="bar" data={categoryChartData} dataKey="value" xKey="name" color="#10b981" height={200} />
          </div>
        </section>
      )}

      {/* ── Hour of day & Day of week ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {hourChartData.length > 0 && (
          <section>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
              <Clock size={15} color="#f59e0b" strokeWidth={2} />
              Revenue by Hour
            </h3>
            <ChartKit type="bar" data={hourChartData} dataKey="value" xKey="name" color="#f59e0b" height={180} />
          </section>
        )}
        {dowChartData.length > 0 && (
          <section>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
              <CalendarDays size={15} color="#8b5cf6" strokeWidth={2} />
              Revenue by Day
            </h3>
            <ChartKit type="bar" data={dowChartData} dataKey="value" xKey="name" color="#8b5cf6" height={180} />
          </section>
        )}
      </div>

      {/* ── Top products table ─────────────────────────── */}
      {products.length > 0 && (
        <DataTable
          title="Top Products"
          rows={products}
          columns={[
            { key: "productName", label: "Product" },
            { key: "skuCode",     label: "SKU" },
            { key: "qty",         label: "Qty Sold",  render: (v) => fmtNum(v) },
            { key: "revenueCents",label: "Revenue",   render: (v) => fmtBRL(v) },
          ]}
          csvFilename={`${source}-top-products.csv`}
        />
      )}

      {/* ── Full location table ────────────────────────── */}
      {(byLocation ?? []).length > 0 && (
        <DataTable
          title="All Locations"
          rows={byLocation}
          columns={[
            { key: "locationName", label: "Store / Location" },
            { key: "orders",       label: "Orders",    render: (v) => fmtNum(v) },
            { key: "revenueCents", label: "Revenue",   render: (v) => fmtBRL(v) },
          ]}
          csvFilename={`${source}-locations.csv`}
        />
      )}
    </div>
  );
}

// ─── Standard (non-retail) view ───────────────────────────────────────────────

function StandardView({ source, title, range }) {
  const [report, setReport] = useState(null);
  const [error, setError]   = useState("");

  useEffect(() => {
    const params = {};
    if (range?.from)   params.from   = range.from;
    if (range?.to)     params.to     = range.to;
    if (range?.preset) params.preset = range.preset;

    fanboxApi.businessReport(source, params)
      .then((res) => setReport(res.data ?? res))
      .catch((e)  => setError(e.message));
  }, [source, range?.from, range?.to, range?.preset]);

  const kpis = Array.isArray(report?.kpis)
    ? report.kpis
    : Object.entries(report?.kpis ?? {}).map(([k, v]) => ({ key: k, label: prettify(k), value: v }));

  const prev = report?.previousPeriod ?? null;

  // Build delta map from previousPeriod
  function getDelta(kpiKey) {
    if (!prev) return undefined;
    const d = prev[`${kpiKey}DeltaPct`] ?? prev.revenueDeltaPct ?? prev.deltaPct ?? prev.issuedDeltaPct ?? prev.ordersDeltaPct;
    return d != null ? makeDelta(d) : undefined;
  }

  const chartData = kpis
    .filter((k) => typeof k.value === "number" && !k.key?.endsWith("_cents"))
    .slice(0, 8)
    .map((k) => ({ name: k.label ?? prettify(k.key), value: Number(k.value ?? 0) }));

  const revenueData = kpis
    .filter((k) => k.key?.endsWith("_cents"))
    .slice(0, 6)
    .map((k) => ({ name: k.label ?? prettify(k.key), value: Number(k.value ?? 0) / 100 }));

  return (
    <div>
      {/* Period delta banner */}
      {prev && (prev.revenueDeltaPct != null || prev.deltaPct != null || prev.issuedDeltaPct != null) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 13 }}>
          <TrendingUp size={15} color="#16a34a" strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ color: "#166534" }}>
            vs previous period —
            {[
              prev.revenueDeltaPct   != null && `revenue ${prev.revenueDeltaPct > 0 ? "+" : ""}${prev.revenueDeltaPct}%`,
              prev.issuedDeltaPct    != null && `issued ${prev.issuedDeltaPct > 0 ? "+" : ""}${prev.issuedDeltaPct}%`,
              prev.ordersDeltaPct    != null && `orders ${prev.ordersDeltaPct > 0 ? "+" : ""}${prev.ordersDeltaPct}%`,
              prev.deltaPct          != null && `entries ${prev.deltaPct > 0 ? "+" : ""}${prev.deltaPct}%`,
            ].filter(Boolean).map((s, i) => (
              <strong key={i} style={{ marginLeft: 6, color: (parseFloat(s) >= 0) ? "#16a34a" : "#dc2626" }}>{s}</strong>
            ))}
          </span>
        </div>
      )}

      {/* KPI cards */}
      {kpis.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
          {kpis.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label ?? prettify(k.key)}
              value={fmtKpi(k.key, k.value)}
              delta={getDelta(k.key)}
            />
          ))}
        </div>
      )}

      {/* Charts — numeric (non-cents) KPIs */}
      {chartData.length >= 2 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <BarChart2 size={15} color="#6366f1" strokeWidth={2} />
            Activity KPIs
          </h3>
          <ChartKit type="bar" data={chartData} dataKey="value" xKey="name" color="#6366f1" height={200} />
        </section>
      )}

      {/* Revenue bars (cents KPIs) */}
      {revenueData.length >= 1 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <TrendingUp size={15} color="#10b981" strokeWidth={2} />
            Revenue Breakdown
          </h3>
          <ChartKit type="bar" data={revenueData} dataKey="value" xKey="name" color="#10b981" height={180} />
        </section>
      )}

      {/* Location table — stores/ecommerce/coxa-foods from fanboxAnalyticsService */}
      {(report?.top5Locations ?? []).length > 0 && (
        <DataTable
          title="Top Locations"
          rows={report.top5Locations}
          columns={[
            { key: "locationName", label: "Location" },
            { key: "orders",       label: "Orders",  render: (v) => fmtNum(v) },
            { key: "revenueCents", label: "Revenue", render: (v) => fmtBRL(v) },
          ]}
          csvFilename={`${source}-locations.csv`}
        />
      )}

      {/* Detail table */}
      {kpis.length > 0 && (
        <DataTable
          title={`${title} — Detail`}
          rows={kpis}
          columns={[
            { key: "key",   label: "Metric", render: (v) => prettify(v) },
            { key: "value", label: "Value",  render: (_, row) => fmtKpi(row.key, row.value) },
          ]}
          csvFilename={`business-${source}.csv`}
        />
      )}

      {/* Stub notice */}
      {report?.stub && (
        <div style={{ padding: "12px 16px", background: "#fef9c3", borderRadius: 8, border: "1px solid #fde047", fontSize: 13, color: "#854d0e", marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} color="#854d0e" strokeWidth={2} style={{ flexShrink: 0 }} />
          Data ingestion for <strong>{title}</strong> is not yet connected. Showing placeholder values.
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BusinessReportPage({ title, source }) {
  const { range, storeId } = useOutletContext();
  const isRetail = RETAIL_SOURCES.has(source);

  return (
    <div className="page">
      <section className="dashboard-section" style={{ marginBottom: 0 }}>
        <h2 className="overview-section-title" style={{ marginBottom: 16 }}>{title}</h2>
        {isRetail ? (
          <RetailView source={source} range={range} storeId={storeId} />
        ) : (
          <StandardView source={source} title={title} range={range} />
        )}
      </section>
    </div>
  );
}
