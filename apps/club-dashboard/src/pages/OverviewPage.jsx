import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  Zap,
  UserCircle,
  Layers,
  Star,
  Receipt,
  Trophy,
  Building2,
  CalendarDays,
  ArrowRight,
  Brain,
  Target,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import PageHeader from "../components/PageHeader.jsx";

const MODULES = [
  {
    to: "/retail/stock",
    icon: Boxes,
    title: "Retail & inventory",
    desc: "Catalog, multi-location stock, transfers, POS sales and fan shop orders.",
    link: "Open retail",
  },
  {
    to: "/cdp/events",
    icon: Zap,
    title: "Event stream",
    desc: "Domain events from sales, loyalty and inventory — the backbone of CDP.",
    link: "View events",
  },
  {
    to: "/cdp/customer-360",
    icon: UserCircle,
    title: "Customer 360",
    desc: "Unified fan profile with traits, segments, loyalty and personalization.",
    link: "Search fans",
  },
  {
    to: "/cdp/segments",
    icon: Layers,
    title: "Segments",
    desc: "Audience builder powered by computed fan traits and purchase behavior.",
    link: "Manage segments",
  },
  {
    to: "/loyalty",
    icon: Star,
    title: "Loyalty program",
    desc: "Points earn rules, ledger and manual adjustments for fan rewards.",
    link: "Loyalty admin",
  },
  {
    to: "/retail/sales",
    icon: Receipt,
    title: "Sales",
    desc: "POS and fan shop transactions with automatic stock and points updates.",
    link: "View sales",
  },
  {
    to: "/ticketing/events",
    icon: CalendarDays,
    title: "Ticketing & events",
    desc: "Match fixtures, ticket products, reservations, entitlements and member check-in.",
    link: "Manage events",
  },
];

export default function OverviewPage() {
  const { user, club, membership } = useAuth();
  const [stats, setStats] = useState(null);
  const [mlKpis, setMlKpis] = useState(null);

  useEffect(() => {
    Promise.all([
      api.listEvents({ limit: 200 }).catch(() => ({ total: 0, data: [] })),
      api.listSegments().catch(() => ({ total: 0 })),
    ]).then(([events, segments]) => {
      setStats({
        eventCount: events?.total ?? events?.data?.length ?? 0,
        segmentCount: segments?.total ?? 0,
      });
    });

    // Load ML activation KPIs
    const token = localStorage.getItem("club_token");
    const clubId = localStorage.getItem("club_id");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (clubId) headers["X-Club-Id"] = clubId;
    fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/cdp/ml/summary`, { headers })
      .then((r) => r.json())
      .then((r) => setMlKpis(r.data ?? null))
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        module={club?.name ?? "Club console"}
        title={`Welcome, ${user?.fullName?.split(" ")[0] ?? "Admin"}`}
        description={`${club?.city ?? ""}${club?.city && club?.country ? ", " : ""}${club?.country ?? ""} · ${membership?.role ?? "member"} access`}
      />

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-card__icon">
            <Trophy size={18} strokeWidth={2} />
          </span>
          <span className="kpi-card__value">{club?.sport ?? "—"}</span>
          <span className="kpi-card__label">Sport</span>
        </div>
        <div className="kpi-card kpi-card--accent">
          <span className="kpi-card__icon">
            <Zap size={18} strokeWidth={2} />
          </span>
          <span className="kpi-card__value">{stats?.eventCount ?? "—"}</span>
          <span className="kpi-card__label">CDP events</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__icon">
            <Layers size={18} strokeWidth={2} />
          </span>
          <span className="kpi-card__value">{stats?.segmentCount ?? "—"}</span>
          <span className="kpi-card__label">Segments</span>
        </div>
        {club?.stadiumName && (
          <div className="kpi-card">
            <span className="kpi-card__icon">
              <Building2 size={18} strokeWidth={2} />
            </span>
            <span className="kpi-card__value kpi-card__value--sm">{club.stadiumName}</span>
            <span className="kpi-card__label">Stadium</span>
          </div>
        )}
      </div>

      <h2 className="overview-section-title">Modules</h2>
      <div className="module-cards">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.to} to={m.to} className="module-card">
              <span className="module-card__icon">
                <Icon size={20} strokeWidth={2} />
              </span>
              <h3>{m.title}</h3>
              <p>{m.desc}</p>
              <span className="module-card__link">
                {m.link}
                <ArrowRight size={14} strokeWidth={2} />
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── ML Activation KPI Strip — Phase 4 ────────────────────── */}
      {mlKpis && (
        <div style={{ marginTop: 28 }}>
          <h2 className="overview-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Brain size={16} color="#8b5cf6" strokeWidth={2} />
            ML Activation Signals
          </h2>
          <div className="kpi-grid">
            <div className="kpi-card" style={{ borderLeft: "3px solid #dc2626" }}>
              <span className="kpi-card__icon"><Target size={18} strokeWidth={2} /></span>
              <span className="kpi-card__value">{Number(mlKpis.high_risk_fans ?? 0).toLocaleString()}</span>
              <span className="kpi-card__label">High Churn Risk</span>
            </div>
            <div className="kpi-card" style={{ borderLeft: "3px solid #3b82f6" }}>
              <span className="kpi-card__icon"><Zap size={18} strokeWidth={2} /></span>
              <span className="kpi-card__value">{((mlKpis.avg_ticket_propensity ?? 0) * 100).toFixed(0)}%</span>
              <span className="kpi-card__label">Avg Ticket Propensity</span>
            </div>
            <div className="kpi-card" style={{ borderLeft: "3px solid #059669" }}>
              <span className="kpi-card__icon"><TrendingUp size={18} strokeWidth={2} /></span>
              <span className="kpi-card__value">{((mlKpis.avg_retail_propensity ?? 0) * 100).toFixed(0)}%</span>
              <span className="kpi-card__label">Avg Retail Propensity</span>
            </div>
            {(mlKpis.channelDistribution ?? []).slice(0, 1).map((ch) => (
              <div key={ch.next_best_channel} className="kpi-card kpi-card--accent">
                <span className="kpi-card__icon"><Brain size={18} strokeWidth={2} /></span>
                <span className="kpi-card__value" style={{ textTransform: "capitalize" }}>{ch.next_best_channel ?? "—"}</span>
                <span className="kpi-card__label">Top Channel</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
