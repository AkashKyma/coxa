/**
 * Club Analytics Dashboard — /analytics
 *
 * Phase 2 operational intelligence for club staff.
 * Powered by Cube (ClickHouse) with MongoDB fallback.
 *
 * Shows:
 *  - Overview KPI strip (revenue, attendees, members, loyalty)
 *  - Retail performance (POS revenue, top products, locations)
 *  - F&B performance (stand revenue, top items)
 *  - Ticketing & check-in KPIs
 *  - Membership health (active, churn risk, renewals)
 *  - Loyalty activity (points earned/redeemed, tier upgrades)
 */
import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, ShoppingBag, Coffee, Ticket, Star, Award,
  TrendingUp, TrendingDown, RefreshCw, Loader2, AlertCircle,
  DollarSign, Users, Activity,
} from "lucide-react";
import { api, formatBrl } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import { DateRangeFilter, KpiCard, ChartKit } from "@coxa/ui-analytics";
import { useClubAnalytics } from "../../lib/useClubAnalytics.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR");
}
function fmtPct(n) {
  if (n == null) return "—";
  return `${Number(n).toFixed(1)}%`;
}
function fmtKpi(key, value) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  const k = String(key);
  if (k.endsWith("_cents") || k.includes("revenue") || k.includes("_arpu") || k.includes("value_cents")) return formatBrl(value);
  if (k.endsWith("_pct") || k.endsWith("_rate_pct")) return fmtPct(value);
  return fmtNum(value);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, color = "#6366f1" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={color} strokeWidth={2} />
      </span>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>{label}</h2>
      <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
    </div>
  );
}

function KpiGrid({ items }) {
  if (!items?.length) return <p style={{ fontSize: 13, color: "#94a3b8" }}>No data for this period.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
      {items.map((item) => (
        <KpiCard
          key={item.key ?? item.label}
          label={item.label}
          value={fmtKpi(item.key, item.value)}
          delta={item.delta}
        />
      ))}
    </div>
  );
}

function SectionLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0", color: "#94a3b8" }}>
      <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  );
}

function SectionError({ message }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "#fef2f2", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
      <AlertCircle size={14} />
      <span>{message}</span>
    </div>
  );
}

function TopProductsTable({ products }) {
  if (!products?.length) return null;
  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>#</th>
            <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>Product</th>
            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {products.slice(0, 8).map((p, i) => (
            <tr key={p.productId ?? p.sku ?? i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "6px 8px", color: "#94a3b8" }}>{i + 1}</td>
              <td style={{ padding: "6px 8px", fontWeight: 500, color: "#1e293b" }}>{p.productName ?? p.name ?? "—"}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#475569" }}>{fmtNum(p.qty ?? p.quantity)}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#1e293b", fontWeight: 600 }}>{formatBrl(p.revenueCents ?? p.revenue_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocationsBarChart({ locations }) {
  if (!locations?.length) return null;
  const data = locations.slice(0, 6).map((l) => ({
    name: l.locationName ?? l.name ?? "—",
    value: (l.revenueCents ?? l.revenue_cents ?? 0) / 100,
  }));
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>Revenue by Location (R$)</p>
      <ChartKit type="bar" data={data} dataKey="value" xKey="name" color="#0ea5e9" height={160} />
    </div>
  );
}

// ─── helper: normalise KPI object to array ───────────────────────────────────

function normaliseKpis(raw, labelMap = {}) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => ({
      key: k,
      label: labelMap[k] ?? k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
      value: v,
    }))
    .filter((item) => typeof item.value === "number" || typeof item.value === "string");
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

export default function ClubAnalyticsDashboardPage() {
  const { track } = useClubAnalytics();
  const [dateRange, setDateRange] = useState({ preset: "30d" });

  // section data
  const [overview, setOverview] = useState(null);
  const [retail, setRetail] = useState(null);
  const [retailProducts, setRetailProducts] = useState([]);
  const [retailLocations, setRetailLocations] = useState([]);
  const [fnb, setFnb] = useState(null);
  const [fnbProducts, setFnbProducts] = useState([]);
  const [ticketing, setTicketing] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loyalty, setLoyalty] = useState(null);

  // loading / error per section
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const setL = (key, val) => setLoading((p) => ({ ...p, [key]: val }));
  const setE = (key, val) => setErrors((p) => ({ ...p, [key]: val }));

  const params = {
    ...(dateRange.from ? { from: dateRange.from } : {}),
    ...(dateRange.to ? { to: dateRange.to } : {}),
    ...(dateRange.preset ? { preset: dateRange.preset } : {}),
  };

  const load = useCallback(async () => {
    track("analytics_dashboard_loaded", { preset: dateRange.preset });

    // overview
    setL("overview", true); setE("overview", null);
    api.analyticsOverview(params)
      .then((r) => setOverview(r.data ?? null))
      .catch((e) => setE("overview", e.message))
      .finally(() => setL("overview", false));

    // retail
    setL("retail", true); setE("retail", null);
    Promise.all([
      api.analyticsRetail({ ...params, channel: "pos" }),
      api.analyticsRetailTopProducts({ ...params, channel: "pos", limit: 8 }),
      api.analyticsRetailByLocation(params),
    ]).then(([r, p, l]) => {
      setRetail(r.data ?? null);
      setRetailProducts(p.data ?? []);
      setRetailLocations(l.data ?? []);
    }).catch((e) => setE("retail", e.message))
      .finally(() => setL("retail", false));

    // fnb
    setL("fnb", true); setE("fnb", null);
    Promise.all([
      api.analyticsFnb(params),
      api.analyticsFnbTopProducts({ ...params, limit: 8 }),
    ]).then(([r, p]) => {
      setFnb(r.data ?? null);
      setFnbProducts(p.data ?? []);
    }).catch((e) => setE("fnb", e.message))
      .finally(() => setL("fnb", false));

    // ticketing
    setL("ticketing", true); setE("ticketing", null);
    api.analyticsTicketing(params)
      .then((r) => setTicketing(r.data ?? null))
      .catch((e) => setE("ticketing", e.message))
      .finally(() => setL("ticketing", false));

    // membership
    setL("membership", true); setE("membership", null);
    api.analyticsMembership(params)
      .then((r) => setMembership(r.data ?? null))
      .catch((e) => setE("membership", e.message))
      .finally(() => setL("membership", false));

    // loyalty
    setL("loyalty", true); setE("loyalty", null);
    api.analyticsLoyalty(params)
      .then((r) => setLoyalty(r.data ?? null))
      .catch((e) => setE("loyalty", e.message))
      .finally(() => setL("loyalty", false));

  }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── overview top-line strip ──────────────────────────────────────────────

  const overviewItems = overview ? [
    { key: "totalRevenueCents", label: "Total Revenue", value: (overview.retail?.totalRevenueCents ?? 0) + (overview.fnb?.totalRevenueCents ?? 0) + (overview.membership?.totalRevenueCents ?? 0) },
    { key: "totalAttendees", label: "Attendees", value: overview.ticketing?.totalAttendees ?? overview.ticketing?.totalAttendances },
    { key: "activeMembers", label: "Active Members", value: overview.membership?.activeMembers ?? overview.membership?.totalActiveMembers },
    { key: "loyaltyPointsEarned", label: "Points Earned", value: overview.loyalty?.pointsEarned },
  ].filter((i) => i.value != null) : [];

  return (
    <div className="page">
      <PageHeader
        module="Analytics"
        title="Club Intelligence"
        description="Operational KPIs from your Cube semantic layer — retail, F&B, ticketing, membership, loyalty."
        actions={
          <button
            onClick={load}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            Refresh
          </button>
        }
      />

      {/* Date filter */}
      <div style={{ marginBottom: 24 }}>
        <DateRangeFilter
          value={dateRange}
          onChange={(v) => setDateRange(v)}
          showPresets
          presets={PRESETS}
        />
      </div>

      {/* ── Overview strip ─────────────────────────────────────────── */}
      {overviewItems.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 32, padding: "16px 20px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 14 }}>
          {overviewItems.map((item) => (
            <div key={item.key} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{fmtKpi(item.key, item.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Retail POS ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <SectionHeader icon={ShoppingBag} label="Retail (POS)" color="#0ea5e9" />
        {loading.retail ? <SectionLoader /> : errors.retail ? <SectionError message={errors.retail} /> : (
          <>
            <KpiGrid items={normaliseKpis(retail?.summary ?? retail, {
              totalRevenueCents: "Revenue",
              totalOrders: "Orders",
              uniqueBuyers: "Unique Buyers",
              avgOrderValueCents: "Avg Order Value",
              itemsSold: "Items Sold",
              avgItemsPerOrder: "Items / Order",
            })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <TopProductsTable products={retailProducts} />
              <LocationsBarChart locations={retailLocations} />
            </div>
          </>
        )}
      </section>

      {/* ── F&B ──────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <SectionHeader icon={Coffee} label="Food & Beverage" color="#f59e0b" />
        {loading.fnb ? <SectionLoader /> : errors.fnb ? <SectionError message={errors.fnb} /> : (
          <>
            <KpiGrid items={normaliseKpis(fnb?.summary ?? fnb?.kpis ?? fnb, {
              totalRevenueCents: "F&B Revenue",
              revenueCents: "F&B Revenue",
              totalOrders: "Orders",
              orders: "Orders",
              uniqueBuyers: "Unique Buyers",
              uniqueFans: "Unique Buyers",
              avgOrderValueCents: "Avg Order",
              totalItems: "Items Sold",
              itemsSold: "Items Sold",
            })} />
            <TopProductsTable products={fnbProducts} />
          </>
        )}
      </section>

      {/* ── Ticketing ────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <SectionHeader icon={Ticket} label="Ticketing & Access" color="#ef4444" />
        {loading.ticketing ? <SectionLoader /> : errors.ticketing ? <SectionError message={errors.ticketing} /> : (
          <KpiGrid items={normaliseKpis(ticketing?.kpis ?? ticketing, {
            totalAttendances: "Total Attendances",
            uniqueAttendees: "Unique Attendees",
            ticketsIssued: "Tickets Issued",
            ticketsUsed: "Tickets Used",
            useRatePct: "Use Rate",
            avgTicketValueCents: "Avg Ticket Value",
            noShows: "No-shows",
          })} />
        )}
      </section>

      {/* ── Membership ──────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <SectionHeader icon={Star} label="Membership" color="#8b5cf6" />
        {loading.membership ? <SectionLoader /> : errors.membership ? <SectionError message={errors.membership} /> : (
          <>
            <KpiGrid items={normaliseKpis(membership?.kpis ?? membership, {
              activeMembers: "Active Members",
              totalActiveMembers: "Active Members",
              newMembers: "New Members",
              renewedMembers: "Renewals",
              cancelledMembers: "Cancellations",
              churnRatePct: "Churn Rate",
              membersAtRiskCount: "At Renewal Risk",
              totalRevenueCents: "Membership Revenue",
              mrrCents: "MRR",
            })} />
            {(membership?.planMix ?? []).length > 0 && (
              <ChartKit
                type="pie"
                data={membership.planMix.map((p) => ({ name: p.planName ?? p.planCode ?? "Plan", value: p.count }))}
                dataKey="value"
                xKey="name"
                height={180}
              />
            )}
          </>
        )}
      </section>

      {/* ── Loyalty ─────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <SectionHeader icon={Award} label="Loyalty Program" color="#ec4899" />
        {loading.loyalty ? <SectionLoader /> : errors.loyalty ? <SectionError message={errors.loyalty} /> : (
          <KpiGrid items={normaliseKpis(loyalty?.kpis ?? loyalty, {
            pointsEarned: "Points Earned",
            pointsRedeemed: "Points Redeemed",
            activeEarners: "Active Earners",
            activeEarnersPct: "Active Earner %",
            dormantCount: "Dormant Fans",
            tierUpgradeRatePct: "Tier Upgrade Rate",
            pointsBurnRatePct: "Burn Rate",
            rewardRedemptions: "Reward Redemptions",
          })} />
        )}
      </section>
    </div>
  );
}
