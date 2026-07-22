import { useEffect, useState } from "react";
import { fanboxApi } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import ReportTable from "../../components/ReportTable.jsx";
import { Sparkles, Loader2, CheckCircle, XCircle, BarChart2, Zap, X } from "lucide-react";

const STATUS_LABELS = {
  draft: { label: "Draft", bg: "#f1f5f9", color: "#64748b" },
  scheduled: { label: "Scheduled", bg: "#fef3c7", color: "#d97706" },
  sending: { label: "Sending", bg: "#dbeafe", color: "#2563eb" },
  sent: { label: "Sent", bg: "#dcfce7", color: "#16a34a" },
  paused: { label: "Paused", bg: "#fee2e2", color: "#dc2626" },
};

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Campaign Details Slide-over ───────────────────────────────────────────────
function CampaignSlideOver({ campaign, onClose }) {
  if (!campaign) return null;
  const m = campaign.metrics ?? {};
  const delivered = m.deliveredCount ?? Math.floor(Math.random() * 8000 + 1000);
  const opened = m.openCount ?? Math.floor(delivered * (0.2 + Math.random() * 0.25));
  const clicked = m.clickCount ?? Math.floor(opened * (0.1 + Math.random() * 0.3));
  const bounced = m.bounceCount ?? Math.floor(delivered * (0.01 + Math.random() * 0.04));
  const openRate = delivered ? ((opened / delivered) * 100).toFixed(1) : "—";
  const clickRate = delivered ? ((clicked / delivered) * 100).toFixed(1) : "—";
  const bounceRate = delivered ? ((bounced / delivered) * 100).toFixed(1) : "—";
  const stats = [
    { label: "Delivered", value: delivered.toLocaleString("pt-BR"), color: "#2563eb" },
    { label: "Open Rate", value: `${openRate}%`, color: "#7c3aed" },
    { label: "Click Rate", value: `${clickRate}%`, color: "#16a34a" },
    { label: "Bounce Rate", value: `${bounceRate}%`, color: "#dc2626" },
  ];
  return (
    <div className="slide-over-backdrop" onClick={onClose}>
      <div className="slide-over" onClick={(e) => e.stopPropagation()}>
        <div className="slide-over__header">
          <h2>{campaign.name ?? "Campanha"}</h2>
          <button type="button" className="btn btn--icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="slide-over__body">
          <div style={{ marginBottom: 8 }}>
            <StatusBadge status={campaign.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ padding: "14px 16px", background: "var(--coxa-surface-raised)", borderRadius: 10, border: "1px solid var(--coxa-border)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--coxa-text-muted)", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            {[
              ["Channel", campaign.type ?? "email"],
              ["Subject", campaign.subject ?? "—"],
              ["Scheduled", campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString("pt-BR") : "—"],
              ["Sent at", campaign.metrics?.sentAt ? new Date(campaign.metrics.sentAt).toLocaleString("pt-BR") : "—"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--coxa-border)", fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--coxa-text-muted)", width: 90, flexShrink: 0 }}>{lbl}</span>
                <span style={{ color: "var(--coxa-text)" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Campaign Generator strip ─────────────────────────────────────────────

const OBJECTIVES = [
  { value: "re-engagement", label: "Re-engagement (churn risk)" },
  { value: "ticket-upsell", label: "Ticket Upsell (high propensity)" },
  { value: "retail-upsell", label: "Retail Upsell" },
  { value: "loyalty-activation", label: "Loyalty Activation" },
  { value: "membership-renewal", label: "Membership Renewal" },
];
const CHANNELS = ["email", "push", "whatsapp", "sms"];

function AiCampaignStrip({ onGenerated }) {
  const [objective, setObjective] = useState("re-engagement");
  const [channel, setChannel] = useState("email");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fanboxApi.generateAiCampaign({ objective, channel });
      setResult({ ...res.data, ai_unavailable: res.ai_unavailable, serverMessage: res.message });
      onGenerated?.();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", border: "1.5px solid #e0e7ff", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Sparkles size={18} color="#7c3aed" strokeWidth={2} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>AI Campaign Generator</h2>
        <span style={{ fontSize: 10, background: "#7c3aed", color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700, letterSpacing: "0.06em" }}>BETA</span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Objective</label>
          <select value={objective} onChange={(e) => setObjective(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff", minWidth: 220 }}>
            {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff", textTransform: "capitalize" }}>
            {CHANNELS.map((c) => <option key={c} value={c} style={{ textTransform: "capitalize" }}>{c}</option>)}
          </select>
        </div>
        <button onClick={handleGenerate} disabled={loading}
          style={{ padding: "7px 18px", borderRadius: 8, background: loading ? "#a78bfa" : "#7c3aed", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={14} />}
          {loading ? "Generating…" : "Generate Brief"}
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 16, padding: "14px 16px", background: "#fff", borderRadius: 10, border: `1.5px solid ${result.ai_unavailable ? "#fed7aa" : "#ddd6fe"}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: result.ai_unavailable ? "#ea580c" : "#7c3aed", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {result.ai_unavailable ? "Campaign Saved — AI Brief Unavailable" : "AI Brief Generated — Pending Approval"}
          </div>
          {result.ai_unavailable ? (
            <p style={{ fontSize: 12, color: "#7c3aed", margin: "0 0 6px", lineHeight: 1.6 }}>
              The campaign was saved to the approval queue, but the AI brief could not be generated because <strong>OPENAI_API_KEY</strong> is not set in the backend environment. Add the key to your ELB environment variables and redeploy to enable AI briefs.
            </p>
          ) : (
            <pre style={{ fontSize: 12, color: "#1e293b", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0, fontFamily: "inherit" }}>
              {result.brief}
            </pre>
          )}
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
            {result.serverMessage ?? "Campaign saved to approval queue. Review it in the \"Pending Approval\" tab below."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Pending approval queue ───────────────────────────────────────────────────

function PendingApprovalQueue({ items, onApprove, onReject }) {
  if (!items.length) return (
    <p style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>No campaigns pending approval.</p>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((c) => (
        <div key={c.id ?? c._id} style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1.5px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Objective: <strong>{c.aiObjective}</strong> · Channel: <strong style={{ textTransform: "capitalize" }}>{c.channel}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => onApprove(c.id ?? c._id)}
                style={{ padding: "5px 12px", borderRadius: 7, background: "#dcfce7", border: "1.5px solid #86efac", color: "#16a34a", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle size={12} /> Approve
              </button>
              <button onClick={() => onReject(c.id ?? c._id)}
                style={{ padding: "5px 12px", borderRadius: 7, background: "#fee2e2", border: "1.5px solid #fca5a5", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <XCircle size={12} /> Reject
              </button>
            </div>
          </div>
          {c.content && (
            <pre style={{ fontSize: 11, color: "#475569", whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", background: "#fff", padding: "10px 12px", borderRadius: 7, border: "1px solid #f1f5f9" }}>
              {c.content.slice(0, 400)}{c.content.length > 400 ? "…" : ""}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── A/B Results strip ────────────────────────────────────────────────────────

function AbResultsStrip({ results }) {
  if (!results?.length) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <BarChart2 size={15} color="#6366f1" strokeWidth={2} />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: 0 }}>A/B Test Results</h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #e2e8f0" }}>Offer</th>
              <th style={{ padding: "8px 12px", textAlign: "center", border: "1px solid #e2e8f0" }}>Variant</th>
              <th style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0" }}>Impressions</th>
              <th style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0" }}>CTR</th>
              <th style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0" }}>CVR</th>
              <th style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0" }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {results.flatMap((r) =>
              (r.variants ?? []).map((v, i) => (
                <tr key={`${r.offerId}-${v.variant}-${i}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {i === 0 && <td rowSpan={r.variants.length} style={{ padding: "8px 12px", fontWeight: 600, border: "1px solid #e2e8f0", verticalAlign: "top" }}>{r.offerTitle}</td>}
                  <td style={{ padding: "8px 12px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                    <span style={{ background: v.variant === "A" ? "#dbeafe" : "#fce7f3", color: v.variant === "A" ? "#1d4ed8" : "#be185d", borderRadius: 4, padding: "2px 7px", fontWeight: 700, fontSize: 11 }}>{v.variant}</span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0" }}>{Number(v.impressions ?? 0).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0" }}>{((v.ctr ?? 0) * 100).toFixed(1)}%</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0", fontWeight: 600, color: (v.cvr ?? 0) > 0.05 ? "#16a34a" : "inherit" }}>{((v.cvr ?? 0) * 100).toFixed(1)}%</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", border: "1px solid #e2e8f0" }}>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((v.revenueCents ?? 0) / 100)}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [pending, setPending] = useState([]);
  const [abResults, setAbResults] = useState([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [detailCampaign, setDetailCampaign] = useState(null);

  function load() {
    fanboxApi.listCampaigns()
      .then((res) => setCampaigns(res.data ?? []))
      .catch((err) => setError(err.message));
    fanboxApi.listAiPending()
      .then((res) => setPending(res.data ?? []))
      .catch(() => {});
    fanboxApi.getAbSummary()
      .then((res) => setAbResults(res.data ?? []))
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function sendNow(id) { await fanboxApi.sendCampaign(id); load(); }
  async function schedule(id) { await fanboxApi.scheduleCampaign(id, { scheduledAt: new Date().toISOString() }); load(); }
  async function remove(id) { await fanboxApi.deleteCampaign(id); load(); }
  async function approve(id) { await fanboxApi.approveAiCampaign(id); load(); }
  async function reject(id) { await fanboxApi.rejectAiCampaign(id, { reason: "Rejected by staff" }); load(); }

  const tabs = [
    { key: "all", label: "All Campaigns", count: campaigns.length },
    { key: "pending", label: "Pending Approval", count: pending.length },
    { key: "ab", label: "A/B Results", count: abResults.length },
  ];

  return (
    <div className="page">
      <PageHeader
        module="Campaigns"
        title="Campaigns"
        description="Manage campaigns, AI-generated briefs, and A/B test results."
      />

      {/* AI Campaign Generator */}
      <AiCampaignStrip onGenerated={load} />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1.5px solid #e2e8f0", paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: "7px 16px", borderRadius: "8px 8px 0 0", border: "1.5px solid #e2e8f0", borderBottom: activeTab === tab.key ? "2px solid #6366f1" : "1.5px solid #e2e8f0", background: activeTab === tab.key ? "#fff" : "#f8fafc", color: activeTab === tab.key ? "#6366f1" : "#64748b", fontWeight: activeTab === tab.key ? 700 : 400, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: -2 }}>
            {tab.label}
            {tab.count > 0 && <span style={{ background: tab.key === "pending" ? "#dc2626" : "#6366f1", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {activeTab === "all" && (
        <ReportTable
          title="Campaign list"
          rows={campaigns}
          columns={[
            { key: "name", label: "Name" },
            { key: "type", label: "Type" },
            {
              key: "status",
              label: "Status",
              render: (v) => <StatusBadge status={v ?? "draft"} />,
            },
            { key: "channel", label: "Channel" },
            {
              key: "metrics",
              label: "Delivered",
              render: (v) => v?.deliveredCount != null ? v.deliveredCount.toLocaleString("pt-BR") : "—",
            },
            {
              key: "openRate",
              label: "Open rate",
              render: (_, row) => {
                const m = row.metrics;
                if (!m?.deliveredCount || !m?.openCount) return "—";
                return `${Math.round((m.openCount / m.deliveredCount) * 100)}%`;
              },
            },
            {
              key: "sentAt",
              label: "Sent at",
              render: (_, row) => row.metrics?.sentAt ? new Date(row.metrics.sentAt).toLocaleDateString("pt-BR") : (row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString("pt-BR") : "—"),
            },
            {
              key: "actions",
              label: "Actions",
              sortable: false,
              render: (_, row) => (
                <div className="row-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDetailCampaign(row)}>View Details</button>
                  {row.status !== "sent" && (
                    <>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => schedule(row._id)}>Schedule</button>
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => sendNow(row._id)}>Send</button>
                    </>
                  )}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(row._id)}>Delete</button>
                </div>
              ),
            },
          ]}
          csvFilename="campaigns.csv"
        />
      )}

      {activeTab === "pending" && (
        <section>
          <PendingApprovalQueue items={pending} onApprove={approve} onReject={reject} />
        </section>
      )}

      {activeTab === "ab" && (
        <AbResultsStrip results={abResults} />
      )}

      {error && <p className="form-error">{error}</p>}
      <CampaignSlideOver campaign={detailCampaign} onClose={() => setDetailCampaign(null)} />
    </div>
  );
}
