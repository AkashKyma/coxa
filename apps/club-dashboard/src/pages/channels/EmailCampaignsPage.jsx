import { useEffect, useState, useRef } from "react";
import { api, emailApi } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import {
  PenLine,
  CheckCircle,
  Play,
  BarChart2,
  X,
  Plus,
} from "lucide-react";

const STATUS_META = {
  draft:     { label: "Draft",     color: "#6b7280" },
  scheduled: { label: "Scheduled", color: "#3b82f6" },
  sending:   { label: "Sending",   color: "#f59e0b" },
  sent:      { label: "Sent",      color: "#22c55e" },
  paused:    { label: "Paused",    color: "#f97316" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, color: "#adb5bd" };
  return (
    <span
      className="status-pill"
      style={{
        background: meta.color + "22",
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

const EMPTY_FORM = {
  name: "",
  templateId: "",
  segmentId: "",
  scheduledAt: "",
  subjectLine: "",
};

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [statsTarget, setStatsTarget] = useState(null);
  const [stats, setStats] = useState(null);
  const successTimer = useRef(null);

  function showSuccess(msg) {
    clearTimeout(successTimer.current);
    setSuccess(msg);
    successTimer.current = setTimeout(() => setSuccess(null), 4000);
  }

  function load() {
    setLoading(true);
    emailApi
      .listCampaigns()
      .then((r) => setCampaigns(r.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    emailApi
      .listTemplates()
      .then((r) => setTemplates(r.data ?? []))
      .catch(() => {});
    api
      .listSegments()
      .then((r) => setSegments(r.data ?? []))
      .catch(() => {});
  }, []);

  function openModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        subjectLine: form.subjectLine.trim(),
        ...(form.templateId && { templateId: form.templateId }),
        ...(form.segmentId && { segmentId: form.segmentId }),
        ...(form.scheduledAt && { scheduledAt: form.scheduledAt }),
      };
      await emailApi.createCampaign(body);
      showSuccess(`Campaign "${form.name}" created.`);
      closeModal();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(campaign) {
    try {
      await emailApi.approveCampaign(campaign.id ?? campaign._id);
      showSuccess(`"${campaign.name}" approved.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSend(campaign) {
    if (!window.confirm(`Send campaign "${campaign.name}" now?`)) return;
    try {
      await emailApi.sendCampaign(campaign.id ?? campaign._id);
      showSuccess(`"${campaign.name}" queued for sending.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleViewStats(campaign) {
    setStatsTarget(campaign);
    setStats(null);
    try {
      const r = await emailApi.getCampaignStats(campaign.id ?? campaign._id);
      setStats(r.data ?? r);
    } catch (err) {
      setStats({ error: err.message });
    }
  }

  return (
    <div>
      <PageHeader
        module="Channels"
        title="Email Campaigns"
        description="Create, schedule, and track outbound email campaigns."
        actions={
          <button type="button" className="btn btn--primary" onClick={openModal}>
            <Plus size={15} style={{ marginRight: "0.4rem" }} />
            New Campaign
          </button>
        }
      />

      {error && (
        <div className="alert error" style={{ marginBottom: "1rem" }}>
          {error}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setError(null)}
            style={{ marginLeft: "1rem" }}
          >
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="alert success" style={{ marginBottom: "1rem" }}>
          {success}
        </div>
      )}

      {/* ── Campaign list ── */}
      <div className="panel-card">
        <div className="panel-card__body">
          {loading ? (
            <p style={{ padding: "1rem" }}>Loading…</p>
          ) : campaigns.length === 0 ? (
            <div
              style={{
                padding: "3rem 1rem",
                textAlign: "center",
                color: "var(--coxa-text-muted)",
              }}
            >
              <p style={{ marginBottom: "0.75rem" }}>
                No campaigns yet. Create your first email campaign.
              </p>
              <button type="button" className="btn btn--primary" onClick={openModal}>
                <Plus size={14} style={{ marginRight: "0.35rem" }} />
                New Campaign
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Name", "Status", "Audience", "Scheduled", "Sent", "Opened", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "0.6rem 0.75rem",
                            textAlign: "left",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "var(--coxa-text-muted)",
                            borderBottom: "1px solid var(--coxa-border)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <CampaignRow
                      key={c.id ?? c._id}
                      campaign={c}
                      onApprove={handleApprove}
                      onSend={handleSend}
                      onViewStats={handleViewStats}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── New Campaign Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            style={{
              background: "var(--coxa-surface, #fff)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
                New Email Campaign
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Campaign Name */}
                <label style={labelStyle}>
                  Campaign Name *
                  <input
                    name="name"
                    className="form-input"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="e.g. July Membership Renewal"
                    required
                    style={inputStyle}
                  />
                </label>

                {/* Subject Line */}
                <label style={labelStyle}>
                  Subject Line
                  <input
                    name="subjectLine"
                    className="form-input"
                    value={form.subjectLine}
                    onChange={handleFormChange}
                    placeholder="e.g. Renew your membership today!"
                    style={inputStyle}
                  />
                </label>

                {/* Template */}
                <label style={labelStyle}>
                  Template
                  <select
                    name="templateId"
                    className="form-input"
                    value={form.templateId}
                    onChange={handleFormChange}
                    style={inputStyle}
                  >
                    <option value="">— Select template —</option>
                    {templates.map((t) => (
                      <option key={t.id ?? t._id} value={t.id ?? t._id}>
                        {t.name ?? t.slug}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Audience Segment */}
                <label style={labelStyle}>
                  Audience Segment
                  <select
                    name="segmentId"
                    className="form-input"
                    value={form.segmentId}
                    onChange={handleFormChange}
                    style={inputStyle}
                  >
                    <option value="">— All active fans —</option>
                    {segments.map((s) => (
                      <option key={s.id ?? s._id} value={s.id ?? s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Schedule */}
                <label style={labelStyle}>
                  Schedule
                  <input
                    name="scheduledAt"
                    type="datetime-local"
                    className="form-input"
                    value={form.scheduledAt}
                    onChange={handleFormChange}
                    style={inputStyle}
                  />
                  <span
                    style={{ fontSize: "0.75rem", color: "var(--coxa-text-muted)", marginTop: "0.2rem" }}
                  >
                    Leave blank to send immediately after approval.
                  </span>
                </label>
              </div>

              {error && (
                <div className="alert error" style={{ marginTop: "1rem" }}>
                  {error}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.6rem",
                  marginTop: "1.5rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? "Creating…" : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stats Drawer ── */}
      {statsTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatsTarget(null);
          }}
        >
          <div
            style={{
              background: "var(--coxa-surface, #fff)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "440px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>
                Stats — {statsTarget.name}
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setStatsTarget(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {stats === null ? (
              <p style={{ color: "var(--coxa-text-muted)" }}>Loading stats…</p>
            ) : stats.error ? (
              <p style={{ color: "var(--coxa-danger, #ef4444)" }}>{stats.error}</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[
                  { label: "Sent",      value: stats.sent      ?? "—" },
                  { label: "Delivered", value: stats.delivered ?? "—" },
                  { label: "Opened",    value: stats.opened    ?? "—" },
                  { label: "Clicked",   value: stats.clicked   ?? "—" },
                  { label: "Bounced",   value: stats.bounced   ?? "—" },
                  { label: "Open rate", value: stats.openRate  != null ? `${(stats.openRate * 100).toFixed(1)}%` : "—" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      background: "var(--coxa-bg, #f9fafb)",
                      borderRadius: "0.5rem",
                      padding: "0.75rem 1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--coxa-text-muted)",
                        marginBottom: "0.2rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignRow({ campaign: c, onApprove, onSend, onViewStats }) {
  const canApprove = c.status === "draft" && c.approvalStatus !== "approved";
  const canSend    = c.approvalStatus === "approved" && ["draft", "scheduled"].includes(c.status);

  return (
    <tr style={{ borderBottom: "1px solid var(--coxa-border)" }}>
      <td style={cellStyle}>
        <span style={{ fontWeight: 500 }}>{c.name}</span>
        {c.subjectLine && (
          <div style={{ fontSize: "0.75rem", color: "var(--coxa-text-muted)", marginTop: "0.1rem" }}>
            {c.subjectLine}
          </div>
        )}
      </td>
      <td style={cellStyle}>
        <StatusBadge status={c.status} />
      </td>
      <td style={cellStyle}>
        {c.segmentName ? (
          <span className="badge badge--purple">{c.segmentName}</span>
        ) : (
          <span className="badge badge--gray">All fans</span>
        )}
      </td>
      <td style={cellStyle}>
        {c.scheduledAt
          ? new Date(c.scheduledAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </td>
      <td style={cellStyle}>{c.sentCount ?? "—"}</td>
      <td style={cellStyle}>
        {c.openedCount != null
          ? `${c.openedCount}${c.sentCount ? ` (${((c.openedCount / c.sentCount) * 100).toFixed(0)}%)` : ""}`
          : "—"}
      </td>
      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            title="Edit"
            style={{ padding: "0.3rem" }}
          >
            <PenLine size={14} />
          </button>
          {canApprove && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              title="Approve"
              style={{ padding: "0.3rem", color: "#22c55e" }}
              onClick={() => onApprove(c)}
            >
              <CheckCircle size={14} />
            </button>
          )}
          {canSend && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              title="Send now"
              style={{ padding: "0.3rem", color: "#3b82f6" }}
              onClick={() => onSend(c)}
            >
              <Play size={14} />
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            title="View stats"
            style={{ padding: "0.3rem" }}
            onClick={() => onViewStats(c)}
          >
            <BarChart2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "var(--coxa-text)",
};

const inputStyle = {
  marginTop: "0.1rem",
};

const cellStyle = {
  padding: "0.65rem 0.75rem",
  fontSize: "0.875rem",
  verticalAlign: "middle",
};
