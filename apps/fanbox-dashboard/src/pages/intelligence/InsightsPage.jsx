/**
 * Intelligence → Insights  (WS8 / RAG upgrade)
 *
 * Full intelligence centre:
 *  - Cross-department KPI snapshot (fans, engagement, spend, membership, tickets, access, loyalty)
 *  - RAG-powered AI narrative per department + overall summary
 *  - ChartKit visualisations driven by kpiRegistry defaultViz
 *  - Saved filter audience cards with segment sizes
 *  - Date range + department filters
 */

import { useEffect, useState, useCallback } from "react";
import {
  Users, Zap, DollarSign, Star, Ticket, DoorOpen, Award,
  Sparkles, Search, RefreshCw, Loader2, BarChart2,
  TrendingUp, TrendingDown, Brain, ShieldAlert, Activity,
  PieChart as PieIcon, Globe, Layers,
} from "lucide-react";
import { fanboxApi } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import { DateRangeFilter, KpiCard, ChartKit } from "@coxa/ui-analytics";

// ─── helpers ─────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL ?? "";

async function fetchJson(path, body, method) {
  const token = localStorage.getItem("fanbox_token");
  const clubId = localStorage.getItem("fanbox_selected_club_id");
  const resolvedMethod = method ?? (body !== undefined ? "POST" : "GET");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (clubId) headers["X-Club-Id"] = clubId;
  const res = await fetch(`${BASE}${path}`, {
    method: resolvedMethod,
    headers,
    ...(resolvedMethod !== "GET" && body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  return json;
}

function fmtCurrency(cents) {
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
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (key?.endsWith("_cents") || key?.includes("revenue") || key?.includes("arpu") || key?.includes("value_cents")) return fmtCurrency(value);
  if (key?.endsWith("_pct") || key?.endsWith("_rate_pct") || key?.endsWith("_pct")) return fmtPct(value);
  return fmtNum(value);
}

const DEPT_META = {
  fans:       { label: "Fan Base",    color: "#6366f1", Icon: Users },
  engagement: { label: "Engagement",  color: "#0ea5e9", Icon: Zap },
  spend:      { label: "Revenue",     color: "#10b981", Icon: DollarSign },
  membership: { label: "Membership",  color: "#f59e0b", Icon: Star },
  tickets:    { label: "Tickets",     color: "#ef4444", Icon: Ticket },
  access:     { label: "Access",      color: "#8b5cf6", Icon: DoorOpen },
  loyalty:    { label: "Loyalty",     color: "#ec4899", Icon: Award },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function InsightBubble({ text, loading, error }) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
        <Loader2 size={16} color="#6366f1" strokeWidth={2} style={{ flexShrink: 0, animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#64748b", fontStyle: "italic" }}>Generating AI insight…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: "10px 14px", background: "#fef9c3", borderRadius: 10, border: "1px solid #fde047", fontSize: 13, color: "#854d0e" }}>
        {error}
      </div>
    );
  }
  if (!text) return null;
  return (
    <div style={{ padding: "12px 14px", background: "linear-gradient(135deg,#f0f4ff,#fdf4ff)", borderRadius: 10, border: "1px solid #e0e7ff", fontSize: 13, color: "#1e293b", lineHeight: 1.65, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Sparkles size={15} color="#6366f1" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
      <span><strong style={{ color: "#4f46e5" }}>AI Insight: </strong>{text}</span>
    </div>
  );
}

function DeptSection({ deptKey, data, insight, insightLoading, insightError }) {
  const meta = DEPT_META[deptKey] ?? { label: deptKey, color: "#64748b", Icon: BarChart2 };
  const { Icon } = meta;
  // Normalise kpis — backend may return an array OR a plain {key:value} object
  const rawKpis = data?.kpis ?? [];
  const kpis = Array.isArray(rawKpis)
    ? rawKpis
    : Object.entries(rawKpis).map(([k, v]) => ({
        key: k,
        label: k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
        value: v,
      }));
  const prev = data?.previousPeriod ?? null;

  // Build chart data from kpis
  const chartData = kpis
    .filter((k) => typeof k.value === "number")
    .slice(0, 8)
    .map((k) => ({ name: k.label, value: k.value }));

  // Delta helper
  function delta(kpiKey) {
    if (!prev) return undefined;
    const d = prev[`${kpiKey}DeltaPct`] ?? prev.deltaPct ?? prev.revenueDeltaPct ?? prev.issuedDeltaPct;
    return d != null ? { value: d, pct: d, direction: d >= 0 ? "up" : "down" } : undefined;
  }

  return (
    <section style={{ marginBottom: 32 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: `${meta.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={15} color={meta.color} strokeWidth={2} />
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>{meta.label}</h2>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>

      {/* KPI grid */}
      {kpis.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
          {kpis.slice(0, 6).map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={fmtKpi(k.key, k.value)}
              delta={delta(k.key)}
            />
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>No data for this period.</p>
      )}

      {/* Mini chart */}
      {chartData.length >= 2 && (
        <div style={{ marginBottom: 14 }}>
          <ChartKit
            type="bar"
            data={chartData}
            dataKey="value"
            xKey="name"
            color={meta.color}
            height={160}
          />
        </div>
      )}

      {/* AI narrative */}
      <InsightBubble text={insight} loading={insightLoading} error={insightError} />
    </section>
  );
}

function FilterAudienceCard({ filter, index }) {
  const accent = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"][index % 5];
  return (
    <div style={{
      border: `1.5px solid ${accent}33`,
      borderRadius: 12,
      padding: "14px 16px",
      background: `${accent}08`,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{filter.name}</span>
      </div>
      {filter.description && (
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{filter.description}</p>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: accent }}>
          {Number(filter.lastRunCount ?? 0).toLocaleString("pt-BR")}
        </span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>fans matched</span>
      </div>
      {filter.lastRunAt && (
        <span style={{ fontSize: 11, color: "#cbd5e1" }}>
          Last run: {new Date(filter.lastRunAt).toLocaleDateString("pt-BR")}
        </span>
      )}
    </div>
  );
}

// ─── Advanced KPI Section ─────────────────────────────────────────────────────

const ADV_SECTIONS = [
  { key: "revenue",    label: "Revenue Intelligence",  color: "#10b981", Icon: TrendingUp },
  { key: "fan",        label: "Fan Intelligence",       color: "#6366f1", Icon: Brain },
  { key: "membership", label: "Membership",             color: "#f59e0b", Icon: Star },
  { key: "ticket",     label: "Ticket Advanced",        color: "#ef4444", Icon: Ticket },
  { key: "retail",     label: "Retail Advanced",        color: "#0ea5e9", Icon: Layers },
  { key: "loyalty",    label: "Loyalty Advanced",       color: "#ec4899", Icon: Award },
  { key: "social",     label: "Social Advanced",        color: "#8b5cf6", Icon: Globe },
  { key: "fan360",     label: "Fan 360 Value",          color: "#f97316", Icon: Activity },
];

function AdvKpiCard({ label, value, color, icon: IconC, subtitle }) {
  return (
    <div style={{ background: `${color}08`, border: `1.5px solid ${color}22`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconC size={13} color={color} strokeWidth={2} />
        </span>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>{value ?? "—"}</div>
      {subtitle && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function AdvSectionHeader({ label, color, Icon: IconC }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <IconC size={15} color={color} strokeWidth={2} />
      </span>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>{label}</h2>
      <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
    </div>
  );
}

function AdvancedKpiSection({ data, loading }) {
  if (loading) {
    return (
      <section style={{ marginBottom: 32, padding: "20px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={16} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, color: "#64748b" }}>Loading advanced KPIs…</span>
        </div>
      </section>
    );
  }
  if (!data) return null;

  const { fan, membership, revenue, ticket, retail, loyalty, social, fan360 } = data;

  return (
    <section style={{ marginBottom: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "#6366f115", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Brain size={15} color="#6366f1" strokeWidth={2} />
        </span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Advanced KPI Intelligence</h2>
        <span style={{ fontSize: 11, background: "#6366f1", color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>ADVANCED</span>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>

      {/* ── Revenue Intelligence ── */}
      {revenue && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Revenue Intelligence" color="#10b981" Icon={TrendingUp} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            <AdvKpiCard label="Total Platform Revenue" value={fmtCurrency(revenue.totalPlatformRevCents)} color="#10b981" icon={TrendingUp} />
            <AdvKpiCard label="Revenue / Attendee" value={fmtCurrency(revenue.revenuePerAttendeeCents)} color="#10b981" icon={TrendingUp} subtitle="tickets + retail + membership" />
            <AdvKpiCard label="Revenue / Member" value={fmtCurrency(revenue.revenuePerMemberCents)} color="#10b981" icon={TrendingUp} />
            {revenue.revenueGrowthPct != null && (
              <AdvKpiCard label="Revenue Growth" value={fmtPct(revenue.revenueGrowthPct)} color={revenue.revenueGrowthPct >= 0 ? "#10b981" : "#ef4444"} icon={revenue.revenueGrowthPct >= 0 ? TrendingUp : TrendingDown} subtitle="vs previous period" />
            )}
          </div>
          {(revenue.streamBreakdown ?? []).length > 0 && (
            <ChartKit type="bar" data={revenue.streamBreakdown.map((s) => ({ name: s.name, value: s.value / 100 }))} dataKey="value" xKey="name" color="#10b981" height={180} />
          )}
        </div>
      )}

      {/* ── Fan Intelligence ── */}
      {fan && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Fan Intelligence" color="#6366f1" Icon={Brain} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            <AdvKpiCard label="Data Completeness" value={fmtPct(fan.dataCompletenessPct)} color="#6366f1" icon={ShieldAlert} subtitle="CPF + email + phone + address" />
            <AdvKpiCard label="Fans at Churn Risk" value={fmtNum(fan.churnRiskCount)} color="#ef4444" icon={ShieldAlert} subtitle="No activity in 90 days" />
            {fan.cohortRetention30dPct != null && (
              <AdvKpiCard label="30-Day Retention" value={fmtPct(fan.cohortRetention30dPct)} color="#0ea5e9" icon={Activity} subtitle="new fans still active at 30d" />
            )}
            {fan.cohortRetention90dPct != null && (
              <AdvKpiCard label="90-Day Retention" value={fmtPct(fan.cohortRetention90dPct)} color="#0ea5e9" icon={Activity} subtitle="new fans still active at 90d" />
            )}
          </div>
        </div>
      )}

      {/* ── Membership Advanced ── */}
      {membership && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Membership" color="#f59e0b" Icon={Star} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            <AdvKpiCard label="MRR" value={fmtCurrency(membership.mrrCents)} color="#f59e0b" icon={TrendingUp} />
            <AdvKpiCard label="ARR" value={fmtCurrency(membership.arrCents)} color="#f59e0b" icon={TrendingUp} subtitle="MRR × 12" />
            <AdvKpiCard label="Churn Rate" value={fmtPct(membership.churnRatePct)} color={membership.churnRatePct < 5 ? "#10b981" : "#ef4444"} icon={TrendingDown} subtitle="Below 5% is healthy" />
            <AdvKpiCard label="At Renewal Risk" value={fmtNum(membership.membersAtRiskCount)} color="#ef4444" icon={ShieldAlert} subtitle="Expire within 30 days" />
            {membership.revenueRecoveryCents > 0 && (
              <AdvKpiCard label="Win-Back Revenue" value={fmtCurrency(membership.revenueRecoveryCents)} color="#10b981" icon={TrendingUp} />
            )}
          </div>
          {(membership.planMix ?? []).length > 0 && (
            <ChartKit type="pie" data={membership.planMix.map((p) => ({ name: p.planName, value: p.count }))} dataKey="value" xKey="name" height={200} />
          )}
        </div>
      )}

      {/* ── Ticket Advanced ── */}
      {ticket && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Ticket Advanced" color="#ef4444" Icon={Ticket} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            <AdvKpiCard label="Avg Tickets / Match" value={fmtNum(ticket.avgTicketsPerMatch)} color="#ef4444" icon={Ticket} subtitle={`across ${ticket.matchCount} matches`} />
            <AdvKpiCard label="Member Ticket Buyers" value={fmtPct(ticket.memberTicketBuyersPct)} color="#ef4444" icon={Users} />
            <AdvKpiCard label="Revenue / Match" value={fmtCurrency(ticket.ticketRevenuePerMatchCents)} color="#ef4444" icon={TrendingUp} />
          </div>
        </div>
      )}

      {/* ── Retail Advanced ── */}
      {retail && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Retail Advanced" color="#0ea5e9" Icon={Layers} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            <AdvKpiCard label="Retail Spend / Attendee" value={fmtCurrency(retail.retailRevPerAttendeeCents)} color="#0ea5e9" icon={TrendingUp} />
            <AdvKpiCard label="Repeat Buyer Rate" value={fmtPct(retail.repeatBuyerRatePct)} color="#0ea5e9" icon={Activity} subtitle="bought 2+ times" />
            <AdvKpiCard label="Category Concentration" value={fmtPct(retail.categoryConcentrationPct)} color={retail.categoryConcentrationPct > 60 ? "#f59e0b" : "#10b981"} icon={PieIcon} subtitle="top category share of revenue" />
          </div>
        </div>
      )}

      {/* ── Loyalty Advanced ── */}
      {loyalty && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Loyalty Advanced" color="#ec4899" Icon={Award} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            <AdvKpiCard label="Active Earners" value={fmtPct(loyalty.activeEarnersPct)} color="#ec4899" icon={Activity} subtitle="earned points this period" />
            <AdvKpiCard label="Dormant Fans" value={fmtNum(loyalty.dormantCount)} color="#f59e0b" icon={ShieldAlert} subtitle="balance but 90d inactive" />
            <AdvKpiCard label="Tier Upgrade Rate" value={fmtPct(loyalty.tierUpgradeRatePct)} color="#ec4899" icon={TrendingUp} />
            <AdvKpiCard label="Points Burn Rate" value={fmtPct(loyalty.pointsBurnRatePct)} color="#ec4899" icon={Activity} subtitle="redeemed vs outstanding" />
          </div>
        </div>
      )}

      {/* ── Social Advanced ── */}
      {social && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Social Advanced" color="#8b5cf6" Icon={Globe} />
          {(social.byPlatform ?? []).length > 0 && (
            <ChartKit
              type="bar"
              data={social.byPlatform.map((p) => ({ name: p.platform, followers: p.followers, impressions: p.impressions }))}
              series={[
                { key: "followers", label: "Followers", color: "#8b5cf6" },
                { key: "impressions", label: "Impressions", color: "#c4b5fd" },
              ]}
              xKey="name"
              height={200}
            />
          )}
          {social.videoSharePct != null && (
            <div style={{ marginTop: 12 }}>
              <AdvKpiCard label="Video Content Share" value={fmtPct(social.videoSharePct)} color="#8b5cf6" icon={Globe} subtitle="% of impressions from video posts" />
            </div>
          )}
        </div>
      )}

      {/* ── Fan 360 ── */}
      {fan360 && (
        <div style={{ marginBottom: 28 }}>
          <AdvSectionHeader label="Fan 360 Value" color="#f97316" Icon={Activity} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            <AdvKpiCard label="Avg Fan 360 Value" value={fmtCurrency(fan360.avgFan360ValueCents)} color="#f97316" icon={Activity} subtitle="tickets + retail + membership" />
            <AdvKpiCard label="Top 10% Revenue Share" value={fmtPct(fan360.top10RevenueSharePct)} color="#f97316" icon={TrendingUp} subtitle="Pareto concentration" />
            <AdvKpiCard label="Multi-Touchpoint Fans" value={fmtPct(fan360.multiTouchpointFansPct)} color="#10b981" icon={Layers} subtitle="3+ revenue channels" />
          </div>
          {(fan360.topFansBreakdown ?? []).length > 0 && (
            <ChartKit
              type="bar"
              data={fan360.topFansBreakdown.map((f, i) => ({ name: `Fan ${i + 1}`, value: f.totalCents / 100 }))}
              dataKey="value"
              xKey="name"
              color="#f97316"
              height={160}
            />
          )}
        </div>
      )}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [dateRange, setDateRange] = useState({ preset: "30d" });
  const [activeDepts, setActiveDepts] = useState(new Set(Object.keys(DEPT_META)));

  // data state per dept
  const [deptData, setDeptData] = useState({});
  const [deptLoading, setDeptLoading] = useState({});

  // AI insight state per dept
  const [insights, setInsights] = useState({});
  const [insightLoading, setInsightLoading] = useState({});
  const [insightError, setInsightError] = useState({});

  // overall summary
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // saved filters / audiences
  const [filters, setFilters] = useState([]);

  // advanced KPIs
  const [advanced, setAdvanced] = useState(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);

  // ML Intelligence (Phase 3)
  const [mlSummary, setMlSummary] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);

  // A/B Test Results (Phase 4)
  const [abResults, setAbResults] = useState([]);
  const [abLoading, setAbLoading] = useState(false);

  // global error
  const [pageError, setPageError] = useState("");

  // ── fetch all dept data ──────────────────────────────────────────────────

  const loadDeptData = useCallback(async () => {
    const params = {};
    if (dateRange.from) params.from = dateRange.from;
    if (dateRange.to) params.to = dateRange.to;
    if (dateRange.preset) params.preset = dateRange.preset;

    const loaders = {
      fans: () => fanboxApi.fanCounters().then((r) => {
          const d = r.data ?? r;
          const labelMap = { totalFans: "Total Fans", withCpf: "With CPF", withForeigners: "Foreigners", withEmail: "With Email", withPhone: "With Phone", withAddress: "With Address", withoutCpfNotForeigner: "Missing CPF" };
          return { kpis: Object.entries(d).filter(([, v]) => typeof v === "number").map(([k, v]) => ({ key: k, label: labelMap[k] ?? k.replace(/([A-Z])/g, " $1").trim(), value: v })) };
        }),
      engagement: () => fanboxApi.engagementReports(params).then((r) => {
          const d = r.data ?? r;
          // kpis may be a plain object of key→value (not array)
          const kpis = Array.isArray(d.kpis)
            ? d.kpis
            : Object.entries(d.kpis ?? {}).map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(), value: v }));
          return { ...d, kpis };
        }),
      spend: () => fanboxApi.spendReports(params).then((r) => {
          const d = r.data ?? r;
          const kpis = Array.isArray(d.kpis)
            ? d.kpis
            : Object.entries(d.kpis ?? {}).map(([k, v]) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(), value: v }));
          return { ...d, kpis };
        }),
      membership: () => fanboxApi.memberReports(params).then((r) => r.data ?? r),
      tickets:    () => fanboxApi.businessReport("tickets", params).then((r) => r.data ?? r),
      access:     () => fanboxApi.businessReport("access", params).then((r) => r.data ?? r),
      loyalty:    () => fanboxApi.loyaltyReports(params).then((r) => r.data ?? r),
    };

    for (const [dept, loader] of Object.entries(loaders)) {
      if (!activeDepts.has(dept)) continue;
      setDeptLoading((p) => ({ ...p, [dept]: true }));
      loader()
        .then((data) => setDeptData((p) => ({ ...p, [dept]: data })))
        .catch((e) => console.warn(`[insights] ${dept} load error:`, e.message))
        .finally(() => setDeptLoading((p) => ({ ...p, [dept]: false })));
    }

    // Advanced KPIs — fire in parallel
    setAdvancedLoading(true);
    fanboxApi.advancedKpis(params)
      .then((r) => setAdvanced(r.data ?? r))
      .catch((e) => console.warn("[insights] advanced KPI error:", e.message))
      .finally(() => setAdvancedLoading(false));

    // ML Intelligence summary (Phase 3) — GET endpoint
    setMlLoading(true);
    fetchJson("/api/v1/cdp/ml/summary", undefined, "GET")
      .then((r) => setMlSummary(r.data ?? null))
      .catch((e) => console.warn("[insights] ML summary error:", e.message))
      .finally(() => setMlLoading(false));

    // A/B Test Results (Phase 4) — load active offers then fetch their results
    setAbLoading(true);
    fetch("/api/v1/personalization/offers?status=active", {
      headers: { Authorization: `Bearer ${localStorage.getItem("fanbox_token") ?? ""}`, "X-Club-Id": localStorage.getItem("fanbox_selected_club_id") ?? "" },
    })
      .then((r) => r.json())
      .then(async (r) => {
        const offers = r.data ?? [];
        const abOffers = offers.filter((o) => o.abTestEnabled || o.abVariant);
        const results = await Promise.all(
          abOffers.slice(0, 6).map((o) =>
            fanboxApi.getOfferAbResults(o.id ?? o._id)
              .then((res) => ({ ...res.data, offerTitle: o.title, offerId: o.id ?? o._id }))
              .catch(() => null)
          )
        );
        setAbResults(results.filter(Boolean));
      })
      .catch(() => setAbResults([]))
      .finally(() => setAbLoading(false));
  }, [dateRange, activeDepts]);

  // ── fetch saved filters ──────────────────────────────────────────────────

  useEffect(() => {
    fanboxApi.listFilters().then((r) => setFilters(r.data ?? [])).catch(() => {});
  }, []);

  // ── load data on mount + date change ────────────────────────────────────

  useEffect(() => { loadDeptData(); }, [loadDeptData]);

  // ── generate AI insights once data is loaded ─────────────────────────────

  useEffect(() => {
    Object.entries(deptData).forEach(([dept, data]) => {
      const kpis = data?.kpis;
      if (!kpis?.length) return;
      if (insights[dept] || insightLoading[dept]) return;

      setInsightLoading((p) => ({ ...p, [dept]: true }));
      setInsightError((p) => ({ ...p, [dept]: null }));

      const kpisPayload = kpis
        .filter((k) => k.value != null)
        .slice(0, 8)
        .map((k) => ({ key: k.key, label: k.label, value: k.value, unit: k.key?.endsWith("_cents") ? "cents" : k.key?.endsWith("_pct") ? "pct" : "count" }));

      fetchJson("/api/v1/fanbox/ai/insights", {
        kpis: kpisPayload,
        from: dateRange.from,
        to: dateRange.to,
      })
        .then((r) => {
          const text = r.data?.content ?? r.data ?? "";
          setInsights((p) => ({ ...p, [dept]: text }));
        })
        .catch((e) => setInsightError((p) => ({ ...p, [dept]: e.message })))
        .finally(() => setInsightLoading((p) => ({ ...p, [dept]: false })));
    });
  }, [deptData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── overall AI summary (fires when all dept insights ready) ──────────────

  useEffect(() => {
    const loaded = Object.values(insights).filter(Boolean);
    if (loaded.length < 2 || summaryLoading || summary) return;
    setSummaryLoading(true);

    fetchJson("/api/v1/fanbox/ai/assistant", {
      messages: [
        {
          role: "user",
          content:
            `Provide a 3-bullet executive summary of the platform's overall performance based on these department insights:\n\n` +
            Object.entries(insights).map(([k, v]) => `**${DEPT_META[k]?.label ?? k}**: ${v}`).join("\n\n"),
        },
      ],
    })
      .then((r) => setSummary(r.data?.content ?? ""))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [insights, summaryLoading, summary]);

  // ── dept toggle ──────────────────────────────────────────────────────────

  function toggleDept(dept) {
    setActiveDepts((prev) => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <PageHeader
        module="Intelligence"
        title="Insights"
        description="AI-powered cross-department analytics with RAG-grounded narratives."
        actions={
          <button
            onClick={() => { setInsights({}); setSummary(""); loadDeptData(); }}
            style={{ padding: "6px 14px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            Refresh
          </button>
        }
      />

      {pageError && <p className="form-error">{pageError}</p>}

      {/* ── Date filter ─────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <DateRangeFilter
          value={dateRange}
          onChange={(v) => { setDateRange(v); setInsights({}); setSummary(""); }}
          showPresets
        />
      </div>

      {/* ── Dept filter chips ────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
        {Object.entries(DEPT_META).map(([key, meta]) => {
          const { Icon } = meta;
          const active = activeDepts.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleDept(key)}
              style={{
                padding: "5px 12px 5px 10px",
                borderRadius: 20,
                border: `1.5px solid ${active ? meta.color : "#e2e8f0"}`,
                background: active ? `${meta.color}15` : "#fff",
                color: active ? meta.color : "#64748b",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon size={13} strokeWidth={2} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* ── Overall AI Executive Summary ─────────────────────── */}
      {(summaryLoading || summary) && (
        <div style={{
          marginBottom: 32,
          padding: "16px 20px",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          borderRadius: 14,
          color: "#fff",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={15} color="#fff" strokeWidth={2} />
            AI Executive Summary
          </div>
          {summaryLoading ? (
            <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>Analysing all departments…</p>
          ) : (
            <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{summary}</p>
          )}
        </div>
      )}

      {/* ── Department sections ──────────────────────────────── */}
      {Object.keys(DEPT_META).filter((d) => activeDepts.has(d)).map((dept) => (
        <DeptSection
          key={dept}
          deptKey={dept}
          data={deptData[dept]}
          insight={insights[dept]}
          insightLoading={insightLoading[dept]}
          insightError={insightError[dept]}
        />
      ))}

      {/* ── Advanced KPI Intelligence ────────────────────────── */}
      <AdvancedKpiSection data={advanced} loading={advancedLoading} />

      {/* ── ML Intelligence — Phase 3 ────────────────────────── */}
      {(mlLoading || mlSummary) && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#8b5cf615", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Brain size={15} color="#8b5cf6" strokeWidth={2} />
            </span>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>ML Intelligence</h2>
            <span style={{ fontSize: 10, background: "#8b5cf6", color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700, letterSpacing: "0.06em" }}>AI-POWERED</span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          {mlLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <Loader2 size={16} color="#8b5cf6" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: "#64748b" }}>Loading ML scores…</span>
            </div>
          ) : mlSummary ? (
            <>
              {/* Churn Risk Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>High Churn Risk</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#dc2626" }}>{Number(mlSummary.high_risk_fans ?? 0).toLocaleString("pt-BR")}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>fans with score ≥ 0.70</div>
                </div>
                <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Medium Risk</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#d97706" }}>{Number(mlSummary.medium_risk_fans ?? 0).toLocaleString("pt-BR")}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>fans with score 0.40–0.70</div>
                </div>
                <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Low Risk</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#16a34a" }}>{Number(mlSummary.low_risk_fans ?? 0).toLocaleString("pt-BR")}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>fans with score &lt; 0.40</div>
                </div>
                <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Avg Ticket Propensity</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#2563eb" }}>{fmtPct((mlSummary.avg_ticket_propensity ?? 0) * 100)}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>likelihood to buy ticket</div>
                </div>
                <div style={{ background: "#ecfdf5", border: "1.5px solid #a7f3d0", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Avg Retail Propensity</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#059669" }}>{fmtPct((mlSummary.avg_retail_propensity ?? 0) * 100)}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>likelihood to purchase retail</div>
                </div>
              </div>

              {/* Channel Distribution */}
              {(mlSummary.channelDistribution ?? []).length > 0 && (
                <div style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    Next-Best-Channel Distribution
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {mlSummary.channelDistribution.map((ch) => {
                      const chColors = { push: "#8b5cf6", email: "#3b82f6", whatsapp: "#22c55e", sms: "#f59e0b" };
                      const c = chColors[ch.next_best_channel] ?? "#94a3b8";
                      return (
                        <div key={ch.next_best_channel} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: `${c}12`, border: `1.5px solid ${c}33`, borderRadius: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", textTransform: "capitalize" }}>{ch.next_best_channel}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{Number(ch.fan_count).toLocaleString("pt-BR")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {mlSummary.last_scored_at && (
                <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 8, textAlign: "right" }}>
                  ML models last run: {new Date(mlSummary.last_scored_at).toLocaleString("pt-BR")}
                </p>
              )}
            </>
          ) : null}
        </section>
      )}

      {/* ── A/B Test Results — Phase 4 ──────────────────────── */}
      {(abLoading || abResults.length > 0) && (
        <section style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#f0fdf415", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid #bbf7d0" }}>
              <span style={{ fontSize: 14 }}>🧪</span>
            </span>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>A/B Test Results</h2>
            <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "2px 8px", fontWeight: 600 }}>
              PostHog Experiments
            </span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          {abLoading ? (
            <div style={{ padding: "16px 0", color: "#9ca3af", fontSize: 13 }}>Loading A/B test results…</div>
          ) : abResults.length === 0 ? (
            <div style={{ padding: "16px 0", color: "#9ca3af", fontSize: 13 }}>
              No active A/B tests. Enable <code>abTestEnabled</code> on an offer to start experimenting.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
              {abResults.map((test) => {
                const varA = test.variantA ?? test.variants?.[0] ?? {};
                const varB = test.variantB ?? test.variants?.[1] ?? {};
                const totalImpressions = (varA.impressions ?? 0) + (varB.impressions ?? 0);
                const winner = (varA.ctr ?? 0) > (varB.ctr ?? 0) ? "A" : (varB.ctr ?? 0) > (varA.ctr ?? 0) ? "B" : null;
                return (
                  <div key={test.offerId} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#1e293b" }}>
                      {test.offerTitle}
                      {winner && (
                        <span style={{ marginLeft: 8, fontSize: 11, background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "2px 7px", fontWeight: 700 }}>
                          Variant {winner} winning
                        </span>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      {[{ label: "Variant A", data: varA, color: "#3b82f6" }, { label: "Variant B", data: varB, color: "#8b5cf6" }].map(({ label, data, color }) => (
                        <div key={label} style={{ background: "#f8faff", borderRadius: 8, padding: "10px 12px", border: `1.5px solid ${color}22` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {[
                              { k: "Impressions", v: (data.impressions ?? 0).toLocaleString("pt-BR") },
                              { k: "CTR", v: `${((data.ctr ?? 0) * 100).toFixed(1)}%` },
                              { k: "Conversions", v: (data.conversions ?? 0).toLocaleString("pt-BR") },
                              { k: "CVR", v: `${((data.cvr ?? 0) * 100).toFixed(1)}%` },
                            ].map(({ k, v }) => (
                              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                <span style={{ color: "#64748b" }}>{k}</span>
                                <span style={{ fontWeight: 700, color: "#1e293b" }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
                      <span>Total impressions: {totalImpressions.toLocaleString("pt-BR")}</span>
                      {test.significanceLevel != null && (
                        <span style={{ color: test.significanceLevel >= 0.95 ? "#16a34a" : "#d97706", fontWeight: 600 }}>
                          {Math.round(test.significanceLevel * 100)}% confidence
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Saved Filter Audiences ───────────────────────────── */}
      {filters.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#6366f115", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Search size={15} color="#6366f1" strokeWidth={2} />
            </span>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>Saved Audiences</h2>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {filters.map((f, i) => <FilterAudienceCard key={f._id ?? i} filter={f} index={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
