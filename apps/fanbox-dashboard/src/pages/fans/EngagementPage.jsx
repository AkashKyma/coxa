import { useEffect, useState } from "react";
import { Activity, DollarSign, TrendingDown, Users } from "lucide-react";
import PageHeader from "../../components/PageHeader.jsx";
import GrowthChart from "../../components/GrowthChart.jsx";
import StatCard from "../../components/StatCard.jsx";
import ChartPanel from "../../components/ChartPanel.jsx";
import { DataTable, DateRangeFilter, KpiCard } from "@coxa/ui-analytics";
import { fanboxApi } from "../../lib/api.js";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { CHART_COLORS, axisTick, chartMargins, formatChartNumber, gridProps, tooltipStyle } from "../../lib/chartTheme.js";

function centsToR$(v) {
  return `R$\u00a0${(Number(v) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function EngagementPage() {
  const [range, setRange] = useState({});
  const [growth, setGrowth] = useState([]);
  const [engagement, setEngagement] = useState(null);
  const [spend, setSpend] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    Promise.all([
      fanboxApi.fanGrowth({ ...range, granularity: range.granularity ?? "week" }),
      fanboxApi.engagementReports(range),
      fanboxApi.spendReports(range),
    ])
      .then(([growthRes, engagementRes, spendRes]) => {
        if (!alive) return;
        setGrowth(growthRes.data?.series ?? []);
        setEngagement(engagementRes.data ?? {});
        setSpend(spendRes.data ?? {});
      })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [range.from, range.to, range.preset, range.granularity]);

  const kpis = engagement?.kpis ?? {};
  const prevEng = engagement?.previousPeriod;
  const prevSpend = spend?.previousPeriod;
  const spendKpis = spend?.kpis ?? {};

  return (
    <div className="page">
      <PageHeader
        module="Fans"
        title="Engagement & Spend"
        description="Weekly growth, engagement, and spend for the selected period."
        actions={<DateRangeFilter value={range} onChange={setRange} showPresets showGranularity />}
      />

      <GrowthChart data={growth} title="Fan growth" granularity={range.granularity ?? "week"} />

      <section className="dashboard-section">
        <h2 className="overview-section-title">Engagement KPIs</h2>
        {prevEng && (
          <p className="text-muted" style={{ marginBottom: 8, fontSize: 13 }}>
            Attendance vs previous period:{" "}
            <strong style={{ color: (prevEng.attendanceDeltaPct ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
              {prevEng.attendanceDeltaPct != null ? `${prevEng.attendanceDeltaPct > 0 ? "+" : ""}${prevEng.attendanceDeltaPct}%` : "—"}
            </strong>
          </p>
        )}
        <div className="stats-row">
          <KpiCard label="Attendance" value={kpis.attendanceTotal ?? 0} icon={Users} color="green"
            delta={prevEng?.attendanceDeltaPct} tooltip="Total gate entries in the period." />
          <KpiCard label="Unique Attendees" value={kpis.uniqueAttendees ?? 0} icon={Users} color="blue"
            tooltip="Distinct fans who attended." />
          <KpiCard label="Tickets Issued" value={kpis.ticketIssued ?? 0} icon={Activity} color="orange"
            delta={prevEng?.ticketIssuedDeltaPct} tooltip="Tickets sold in the period." />
          <KpiCard label="Tickets Used" value={kpis.ticketUsed ?? 0} icon={Activity} color="purple"
            tooltip="Tickets scanned at the gate." />
          <KpiCard label="Sold but Not Attended" value={kpis.soldNotCheckedIn ?? 0} icon={TrendingDown} color="red"
            tooltip="Issued tickets with no gate scan — no-shows from paid tickets." />
          <KpiCard label="Use Rate" value={`${kpis.ticketUseRatePct ?? 0}%`} icon={Activity} color="green"
            tooltip="% of issued tickets used." />
          <KpiCard label="Avg Ticket Value" value={centsToR$(kpis.avgTicketValueCents ?? 0)} icon={DollarSign} color="blue"
            tooltip="Revenue ÷ tickets issued." />
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="overview-section-title">Spend KPIs</h2>
        {prevSpend && (
          <p className="text-muted" style={{ marginBottom: 8, fontSize: 13 }}>
            Revenue vs previous period:{" "}
            <strong style={{ color: (prevSpend.revenueDeltaPct ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
              {prevSpend.revenueDeltaPct != null ? `${prevSpend.revenueDeltaPct > 0 ? "+" : ""}${prevSpend.revenueDeltaPct}%` : "—"}
            </strong>
          </p>
        )}
        <div className="stats-row">
          <KpiCard label="Total Sales Revenue" value={centsToR$(spendKpis.totalSalesCents ?? 0)} icon={DollarSign} color="green"
            delta={prevSpend?.revenueDeltaPct} tooltip="Total revenue from completed sales." />
          <KpiCard label="Sales Orders" value={spendKpis.salesOrders ?? 0} icon={Activity} color="blue"
            delta={prevSpend?.ordersDeltaPct} tooltip="Number of completed orders." />
          <KpiCard label="Avg Order Value" value={centsToR$(spendKpis.avgOrderValueCents ?? 0)} icon={DollarSign} color="orange"
            tooltip="Revenue ÷ orders." />
          <KpiCard label="Unique Buyers" value={spendKpis.uniqueBuyingFans ?? 0} icon={Users} color="purple"
            tooltip="Distinct fans who made a purchase." />
          <KpiCard label="Membership Revenue" value={centsToR$(spendKpis.totalMembershipCents ?? 0)} icon={DollarSign} color="green"
            tooltip="Revenue from membership transactions." />
          <KpiCard label="Total Combined Revenue" value={centsToR$(spendKpis.totalCombinedRevenueCents ?? 0)} icon={DollarSign} color="blue"
            tooltip="Sales + membership revenue." />
        </div>
      </section>

      <div className="page-grid page-grid--2col">
        <DataTable
          title="Attendance by status"
          rows={engagement?.attendanceByStatus ?? []}
          columns={[
            { key: "status", label: "Status" },
            { key: "count", label: "Count", render: (v) => v?.toLocaleString() },
          ]}
          csvFilename="fans-engagement-attendance.csv"
        />
        <DataTable
          title="Spend by sales channel"
          rows={spend?.byChannel ?? []}
          columns={[
            { key: "channel", label: "Channel" },
            { key: "orders", label: "Orders", render: (v) => v?.toLocaleString() },
            { key: "totalCents", label: "Revenue", render: (v) => centsToR$(v) },
          ]}
          csvFilename="fans-engagement-spend.csv"
        />
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
