import { useEffect, useState } from "react";
import { Activity, DollarSign, Ticket, TrendingUp, Users, Brain, Zap, Target, Shield, Megaphone } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fanboxApi } from "../lib/api.js";
import PageHeader from "../components/PageHeader.jsx";
import DateRangeFilter from "../components/DateRangeFilter.jsx";
import FanCounterCards from "../components/FanCounterCards.jsx";
import GrowthChart from "../components/GrowthChart.jsx";
import StatCard from "../components/StatCard.jsx";
import ReportTable from "../components/ReportTable.jsx";

const ENGAGEMENT_COLORS = ["green", "blue", "orange", "purple"];
const SPEND_COLORS = ["green", "blue", "orange", "red"];
const ENGAGEMENT_ICONS = [Activity, Ticket, TrendingUp, Users];

function toCurrency(cents) {
  const value = Number(cents ?? 0) / 100;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function mapStats(cards = {}) {
  return Object.entries(cards).map(([key, value]) => ({
    key,
    label: key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    value,
  }));
}

function formatKpiValue(key, value) {
  if (String(key).includes("Cents")) return toCurrency(value);
  return Number(value ?? 0).toLocaleString("en-US");
}

export default function OverviewPage() {
  const { user, club } = useAuth();
  const [counters, setCounters] = useState(null);
  const [growthSeries, setGrowthSeries] = useState([]);
  const [engagement, setEngagement] = useState(null);
  const [spend, setSpend] = useState(null);
  const [range, setRange] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activationKpis, setActivationKpis] = useState(null);
  const [platformStats, setPlatformStats] = useState(null);
  const [topSegments, setTopSegments] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      fanboxApi.fanCounters(),
      fanboxApi.fanGrowth({ ...range, granularity: "month" }),
      fanboxApi.engagementReports(range),
      fanboxApi.spendReports(range),
    ])
      .then(([counterRes, growthRes, engagementRes, spendRes]) => {
        if (!active) return;
        setCounters(counterRes.data ?? {});
        setGrowthSeries(growthRes.data?.series ?? []);
        setEngagement(engagementRes.data ?? null);
        setSpend(spendRes.data ?? null);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Load activation KPIs (Phase 4) — non-blocking
    fanboxApi.getMlSummary()
      .then((r) => { if (active) setActivationKpis(r.data ?? null); })
      .catch(() => {});
    // Platform Health stats
    fetch("/api/v1/cdp/stats", { headers: { Authorization: `Bearer ${localStorage.getItem("fanbox_token")}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (active) setPlatformStats(d?.data ?? d ?? null); })
      .catch(() => {});
    fetch("/api/v1/cdp/segments?limit=5&sort=size", { headers: { Authorization: `Bearer ${localStorage.getItem("fanbox_token")}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (active && d) setTopSegments(d.data ?? d ?? []); })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [club?.id, range.from, range.to]);

  const engagementCards = mapStats(engagement?.kpis ?? {});
  const spendCards = mapStats(spend?.kpis ?? {});

  return (
    <div className="page">
      <PageHeader
        module="Dashboard"
        title={`Welcome, ${user?.fullName?.split(" ")[0] ?? "Team"}`}
        description={`Fan analytics and marketing operations for ${club?.name ?? "your club"}.`}
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      <FanCounterCards counters={counters ?? {}} loading={loading && !counters} />

      <section className="dashboard-section">
        <h2 className="overview-section-title">Growth & trends</h2>
        <GrowthChart data={growthSeries} granularity="month" />
      </section>

      <section className="dashboard-section">
        <h2 className="overview-section-title">Engagement & spend</h2>
        <div className="page-grid page-grid--2col">
          <div className="dashboard-column">
            <div className="stats-row">
              {engagementCards.slice(0, 4).map((item, index) => (
                <StatCard
                  key={item.key}
                  icon={ENGAGEMENT_ICONS[index] ?? Activity}
                  label={item.label}
                  value={formatKpiValue(item.key, item.value)}
                  color={ENGAGEMENT_COLORS[index % ENGAGEMENT_COLORS.length]}
                />
              ))}
            </div>
            <ReportTable
              title="Engagement by attendance status"
              rows={engagement?.attendanceByStatus ?? []}
              columns={[
                { key: "status", label: "Status" },
                { key: "count", label: "Count" },
              ]}
              csvFilename="engagement-report.csv"
            />
          </div>
          <div className="dashboard-column">
            <div className="stats-row">
              {spendCards.slice(0, 4).map((item, index) => (
                <StatCard
                  key={item.key}
                  icon={DollarSign}
                  label={item.label}
                  value={formatKpiValue(item.key, item.value)}
                  color={SPEND_COLORS[index % SPEND_COLORS.length]}
                />
              ))}
            </div>
            <ReportTable
              title="Spend by channel"
              rows={spend?.byChannel ?? []}
              columns={[
                { key: "channel", label: "Channel" },
                { key: "orders", label: "Orders" },
                { key: "totalCents", label: "Revenue (cents)" },
              ]}
              csvFilename="spend-report.csv"
            />
          </div>
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="text-muted dashboard-loading">Refreshing dashboard data…</p>}

      {/* ── Activation KPI Strip — Phase 4 ────────────────── */}
      {activationKpis && (
        <section className="dashboard-section" style={{ marginTop: 16 }}>
          <h2 className="overview-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Brain size={16} color="#8b5cf6" strokeWidth={2} />
            ML Activation Signals
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            <StatCard icon={Target} label="High Churn Risk" value={Number(activationKpis.high_risk_fans ?? 0).toLocaleString("pt-BR")} color="red" />
            <StatCard icon={Zap} label="Avg Ticket Propensity" value={`${((activationKpis.avg_ticket_propensity ?? 0) * 100).toFixed(0)}%`} color="blue" />
            <StatCard icon={TrendingUp} label="Avg Retail Propensity" value={`${((activationKpis.avg_retail_propensity ?? 0) * 100).toFixed(0)}%`} color="green" />
            {(activationKpis.channelDistribution ?? []).slice(0, 1).map((ch) => (
              <StatCard key={ch.next_best_channel} icon={Activity} label="Top Channel" value={ch.next_best_channel?.toUpperCase() ?? "—"} color="purple" />
            ))}
          </div>
        </section>
      )}

      {/* ── Platform Health ─────────────────────────────────── */}
      {(() => {
        const MOCK_STATS = { totalFans: 12847, activeSegments: 23, campaignsSentThisMonth: 8, avgFanScore: 42 };
        const stats = platformStats ?? MOCK_STATS;
        const isMock = !platformStats;
        const healthCards = [
          { label: "Total Fans", value: Number(stats.totalFans ?? MOCK_STATS.totalFans).toLocaleString("pt-BR"), trend: "+3.2%", up: true, icon: Users, color: "blue" },
          { label: "Active Segments", value: Number(stats.activeSegments ?? MOCK_STATS.activeSegments).toLocaleString("pt-BR"), trend: "+1", up: true, icon: Target, color: "purple" },
          { label: "Campaigns This Month", value: Number(stats.campaignsSentThisMonth ?? MOCK_STATS.campaignsSentThisMonth).toLocaleString("pt-BR"), trend: "+2", up: true, icon: Megaphone, color: "green" },
          { label: "Avg Fan Score", value: String(stats.avgFanScore ?? MOCK_STATS.avgFanScore), trend: "-1.1%", up: false, icon: Shield, color: "orange" },
        ];
        const segs = topSegments.length > 0 ? topSegments : [
          { name: "Active Members", lastRunCount: 4200 },
          { name: "High Churn Risk", lastRunCount: 1850 },
          { name: "High Spenders", lastRunCount: 980 },
          { name: "Newsletter Opt-in", lastRunCount: 7600 },
          { name: "Match Day Buyers", lastRunCount: 3100 },
        ];
        const maxCount = Math.max(...segs.map((s) => s.lastRunCount ?? 0), 1);
        return (
          <section className="dashboard-section" style={{ marginTop: 16 }}>
            <h2 className="overview-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={16} color="#6366f1" strokeWidth={2} />
              Platform Health
              {isMock && <span style={{ fontSize: 10, background: "#fef3c7", color: "#d97706", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>DEMO</span>}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
              {healthCards.map((c) => {
                const Icon = c.icon;
                const colorMap = { blue: { bg: "#dbeafe", fg: "#2563eb" }, purple: { bg: "#ede9fe", fg: "#7c3aed" }, green: { bg: "#dcfce7", fg: "#16a34a" }, orange: { bg: "#ffedd5", fg: "#ea580c" } };
                const col = colorMap[c.color] ?? colorMap.blue;
                return (
                  <div key={c.label} style={{ background: "var(--coxa-surface)", border: "1px solid var(--coxa-border)", borderRadius: 12, padding: "16px 18px", boxShadow: "var(--coxa-shadow-sm)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: col.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon size={18} color={col.fg} strokeWidth={2} />
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--coxa-text-muted)", fontWeight: 600 }}>{c.label}</span>
                    </div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--coxa-text)" }}>{c.value}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: c.up ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {c.up ? "↑" : "↓"} {c.trend}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top Segments bar chart */}
            <div style={{ background: "var(--coxa-surface)", border: "1px solid var(--coxa-border)", borderRadius: 12, padding: "16px 18px", boxShadow: "var(--coxa-shadow-sm)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 700 }}>Top Segments by Size</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {segs.slice(0, 5).map((s, i) => {
                  const count = s.lastRunCount ?? 0;
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--coxa-text-muted)", width: 160, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.name ?? "Segment"}
                      </span>
                      <div style={{ flex: 1, height: 10, background: "var(--coxa-border)", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--coxa-primary)", borderRadius: 10, transition: "width 0.5s ease" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--coxa-text)", minWidth: 48, textAlign: "right" }}>
                        {count.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
