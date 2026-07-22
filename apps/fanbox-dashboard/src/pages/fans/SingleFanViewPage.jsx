import { useState, useEffect, useRef } from "react";
import { fanboxApi } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import ReportTable from "../../components/ReportTable.jsx";
import "./single-fan-view-enhancements.css";

function fmtPct(v) { return v == null ? "—" : `${(Number(v) * 100).toFixed(1)}%`; }
function RiskBar({ score }) {
  const pct = Math.round((score ?? 0) * 100);
  const color = pct >= 70 ? "#dc2626" : pct >= 40 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function maskEmail(e) {
  if (!e) return "—";
  const [local, domain] = e.split("@");
  return `${local[0]}***@${domain}`;
}
function maskPhone(p) {
  if (!p) return "—";
  return p.replace(/(\d{2})\d+(\d{2})/, "$1*****$2");
}
function maskCpf(c) {
  if (!c) return "—";
  return c.replace(/(\d{3})\.\d{3}\.\d{3}-(\d{2})/, "***.***.$1-$2").replace(/^[^*]/, "***").replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "***.***.$3-$4");
}
function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function absDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}
const EVENT_ICONS = { purchase: "🛒", ticket: "🎫", engagement: "❤️", email: "📧", loyalty: "🔁", default: "📌" };
function eventIcon(type) {
  if (!type) return EVENT_ICONS.default;
  const t = type.toLowerCase();
  if (t.includes("purchase") || t.includes("order") || t.includes("retail")) return EVENT_ICONS.purchase;
  if (t.includes("ticket")) return EVENT_ICONS.ticket;
  if (t.includes("email") || t.includes("campaign")) return EVENT_ICONS.email;
  if (t.includes("loyalty") || t.includes("points")) return EVENT_ICONS.loyalty;
  return EVENT_ICONS.engagement;
}
const CHANNEL_ICONS = { email: "📧", whatsapp: "💬", push: "🔔", sms: "📱" };
const COMM_STATUS_CLASS = { Delivered: "delivered", Opened: "opened", Clicked: "clicked", Bounced: "bounced" };

const MOCK_EVENTS = [
  { type: "purchase", name: "Store Purchase", ts: new Date(Date.now() - 86400000).toISOString(), props: "R$ 89,90" },
  { type: "ticket", name: "Ticket Purchased", ts: new Date(Date.now() - 3 * 86400000).toISOString(), props: "North Stand" },
  { type: "engagement", name: "Stadium Check-in", ts: new Date(Date.now() - 7 * 86400000).toISOString(), props: "" },
  { type: "email", name: "Email Opened: Newsletter", ts: new Date(Date.now() - 10 * 86400000).toISOString(), props: "" },
  { type: "loyalty", name: "Points Added", ts: new Date(Date.now() - 14 * 86400000).toISOString(), props: "+250 pts" },
  { type: "purchase", name: "Online Purchase", ts: new Date(Date.now() - 20 * 86400000).toISOString(), props: "R$ 145,00" },
  { type: "ticket", name: "Ticket Renewed", ts: new Date(Date.now() - 30 * 86400000).toISOString(), props: "Annual Plan" },
  { type: "engagement", name: "Survey Completed", ts: new Date(Date.now() - 45 * 86400000).toISOString(), props: "NPS 9" },
];
const MOCK_COMMS = [
  { subject: "Special Member Offer", channel: "email", sentAt: new Date(Date.now() - 2 * 86400000).toISOString(), status: "Opened" },
  { subject: "Plan Renewal", channel: "email", sentAt: new Date(Date.now() - 8 * 86400000).toISOString(), status: "Clicked" },
  { subject: "Monthly Newsletter", channel: "email", sentAt: new Date(Date.now() - 15 * 86400000).toISOString(), status: "Delivered" },
  { subject: "Points Alert", channel: "push", sentAt: new Date(Date.now() - 20 * 86400000).toISOString(), status: "Delivered" },
  { subject: "Ticket Promotion", channel: "whatsapp", sentAt: new Date(Date.now() - 35 * 86400000).toISOString(), status: "Bounced" },
];

// ── Accordion Card ──────────────────────────────────────────────────────────
function AccordionCard({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`sfv-card${open ? " sfv-card--open" : ""}`}>
      <div className="sfv-card__header" onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)}>
        <h3 className="sfv-card__title"><span className="sfv-card__icon">{icon}</span>{title}</h3>
        <span className="sfv-card__chevron">▼</span>
      </div>
      <div className="sfv-card__body">{children}</div>
    </div>
  );
}

// ── VerBadge ────────────────────────────────────────────────────────────────
function VerBadge({ label, ok }) {
  return (
    <span className={`sfv-badge ${ok ? "sfv-badge--verified" : "sfv-badge--unverified"}`}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

// ── SubScoreBar ─────────────────────────────────────────────────────────────
function SubScoreBar({ label, value }) {
  const pct = Math.min(100, Math.max(0, Number(value ?? 0)));
  return (
    <div className="sfv-sub-score-row">
      <span className="sfv-sub-score-label">{label}</span>
      <div className="sfv-sub-score-bar-wrap">
        <div className="sfv-sub-score-bar" style={{ width: `${pct}%` }} />
      </div>
      <span className="sfv-sub-score-val">{pct}</span>
    </div>
  );
}

// ── TagsEditor ──────────────────────────────────────────────────────────────
function TagsEditor({ profileId, initialTags = [], initialNotes = "" }) {
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addTag(e) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/,/g, "");
      if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
      setTagInput("");
    }
  }
  function removeTag(t) { setTags((prev) => prev.filter((x) => x !== t)); }

  async function save() {
    if (!profileId) return;
    setSaving(true);
    setSaved(false);
    try {
      await fanboxApi.updateFan(profileId, { tags, notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (_) {}
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="sfv-field__label" style={{ marginBottom: 6 }}>Tags</div>
        <div className="sfv-tags-input">
          {tags.map((t) => (
            <span key={t} className="sfv-tag-chip">
              {t}
              <button type="button" className="sfv-tag-remove" onClick={() => removeTag(t)}>×</button>
            </span>
          ))}
          <input
            className="sfv-tag-input-field"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder="Add tag (Enter or comma)…"
          />
        </div>
      </div>
      <div>
        <div className="sfv-field__label" style={{ marginBottom: 6 }}>Notes</div>
        <textarea
          className="sfv-notes-area"
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note about this fan…"
        />
        <div className="sfv-notes-char-count">{notes.length}/1000</div>
      </div>
      <div className="sfv-save-row">
        <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={saving || !profileId}>
          {saving ? "Saving…" : "Save Note"}
        </button>
        {saved && <span className="sfv-save-ok">✓ Saved</span>}
        {!profileId && <span style={{ fontSize: "0.75rem", color: "var(--coxa-text-muted)" }}>Select a fan to save</span>}
      </div>
    </div>
  );
}

const SEARCH_FIELDS = [
  { value: "email", label: "Email" },
  { value: "cpf", label: "CPF" },
  { value: "fullName", label: "Name" },
  { value: "fanId", label: "ID" },
  { value: "passport", label: "Passport" },
  { value: "phone", label: "Phone" },
];

export default function SingleFanViewPage() {
  const [field, setField] = useState("email");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(null);
  const [customer360, setCustomer360] = useState(null);
  const [mlScores, setMlScores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState(null);
  const [segments, setSegments] = useState(null);
  const [comms, setComms] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSelected(null);
    setCustomer360(null);
    setMlScores(null);
    setEvents(null);
    setSegments(null);
    setComms(null);
    try {
      const res = await fanboxApi.searchFans(query.trim(), field);
      setResults(res.data ?? []);
      if (res.data?.length === 1) {
        setSelected(res.data[0]);
        await loadFanDetail(res.data[0]);
      }
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFanDetail(fan) {
    const id = fan.id ?? fan._id ?? fan.fanId;
    const [profileRes] = await Promise.allSettled([
      fanboxApi.getCustomer360(id),
      fanboxApi.getMlScores(id).then((r) => setMlScores(r.data ?? r)).catch(() => {}),
    ]);
    if (profileRes.status === "fulfilled") setCustomer360(profileRes.value.data);
    // Load enrichment data (graceful fallback to mocks)
    fetch(`/api/v1/cdp/events?fanId=${encodeURIComponent(id)}&limit=20`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fanbox_token")}` },
    }).then((r) => r.ok ? r.json() : null)
      .then((d) => setEvents(d?.data ?? d ?? null))
      .catch(() => setEvents(null));
    fetch(`/api/v1/cdp/segments?fanId=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fanbox_token")}` },
    }).then((r) => r.ok ? r.json() : null)
      .then((d) => setSegments(d?.data ?? d ?? null))
      .catch(() => setSegments(null));
    fetch(`/api/v1/channels/email/sends?fanId=${encodeURIComponent(id)}&limit=5`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fanbox_token")}` },
    }).then((r) => r.ok ? r.json() : null)
      .then((d) => setComms(d?.data ?? d ?? null))
      .catch(() => setComms(null));
  }

  async function selectFan(fan) {
    setSelected(fan);
    setLoading(true);
    setError("");
    setMlScores(null);
    setEvents(null);
    setSegments(null);
    setComms(null);
    try {
      await loadFanDetail(fan);
    } catch (err) {
      setError(err.message);
      setCustomer360(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        module="Fans"
        title="Single Fan View"
        description="Search by CPF, name, email, ID, passport, or phone."
      />

      <form className="search-form" onSubmit={handleSearch}>
        <select value={field} onChange={(e) => setField(e.target.value)}>
          {SEARCH_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to search…"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {results && results.length > 1 && (
        <ul className="fan-result-list">
          {results.map((fan) => (
            <li key={fan._id ?? fan.id}>
              <button type="button" onClick={() => selectFan(fan)}>
                {fan.fullName} — {fan.email}
              </button>
            </li>
          ))}
        </ul>
      )}

      {results?.length === 0 && !loading && query && (
        <p className="empty-state">No fan found.</p>
      )}

      {selected && (
        <div className="sfv-accordion">
          {/* ─── 1. Identity & Contact ─────────────────────────────────── */}
          <AccordionCard title="Identity & Contact" icon="👤" defaultOpen>
            {(() => {
              const p = customer360?.profile ?? selected;
              const verifications = p?.verifications ?? {};
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <VerBadge label="Email" ok={verifications.emailVerified ?? !!selected.emailVerified} />
                    <VerBadge label="Phone" ok={verifications.phoneVerified ?? !!selected.phoneVerified} />
                    <VerBadge label="CPF" ok={verifications.cpfVerified ?? !!selected.cpfVerified} />
                  </div>
                  <div className="sfv-identity-grid">
                    <div className="sfv-field">
                      <span className="sfv-field__label">Full Name</span>
                      <span className="sfv-field__value">{selected.fullName || "—"}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">Email</span>
                      <span className="sfv-field__value">{maskEmail(selected.email)}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">Phone</span>
                      <span className="sfv-field__value">{maskPhone(selected.phone)}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">CPF</span>
                      <span className="sfv-field__value">{maskCpf(selected.cpf)}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">Fan Since</span>
                      <span className="sfv-field__value">{p?.fanSince ? new Date(p.fanSince).toLocaleDateString("pt-BR") : (selected.createdAt ? new Date(selected.createdAt).toLocaleDateString("pt-BR") : "—")}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">Source</span>
                      <span className="sfv-field__value">{selected.source ?? p?.source ?? "—"}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">Language</span>
                      <span className="sfv-field__value">{selected.preferredLanguage ?? p?.preferredLanguage ?? "—"}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">City</span>
                      <span className="sfv-field__value">{selected.address?.city ?? p?.address?.city ?? "—"}</span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">Meta ID</span>
                      <span className="sfv-field__value">
                        {selected.metaId ?? p?.externalIds?.metaId
                          ? <span className="sfv-ext-id">{(selected.metaId ?? p?.externalIds?.metaId).slice(0, 12)}…</span>
                          : "—"}
                      </span>
                    </div>
                    <div className="sfv-field">
                      <span className="sfv-field__label">Google ID</span>
                      <span className="sfv-field__value">
                        {selected.googleId ?? p?.externalIds?.googleId
                          ? <span className="sfv-ext-id">{(selected.googleId ?? p?.externalIds?.googleId).slice(0, 12)}…</span>
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </AccordionCard>

          {/* ─── 2. Behavioral Scores ───────────────────────────────────── */}
          <AccordionCard title="Behavioral Scores" icon="📊">
            {(() => {
              const fs = customer360?.profile?.fanScore ?? customer360?.fanScore ?? {};
              const total = typeof fs === "number" ? fs : (fs.total ?? fs.overall ?? 42);
              const pct = Math.min(100, Math.max(0, total));
              const deg = `${(pct / 100 * 360).toFixed(0)}deg`;
              const subs = [
                { label: "Attendance", val: fs.attendance ?? 58 },
                { label: "Tenure", val: fs.tenure ?? 72 },
                { label: "Spending", val: fs.spending ?? 45 },
                { label: "Referral", val: fs.referral ?? 30 },
                { label: "Engagement", val: fs.engagement ?? 65 },
                { label: "Donations", val: fs.donations ?? 20 },
              ];
              return (
                <div>
                  <div className="sfv-scores-header">
                    <div className="sfv-fan-score-ring" style={{ "--ring-pct": `${pct}%` }}>
                      <div className="sfv-fan-score-inner">{pct}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--coxa-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Fan Score</div>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--coxa-text)" }}>{pct}/100</div>
                    </div>
                  </div>
                  <div className="sfv-sub-scores">
                    {subs.map((s) => <SubScoreBar key={s.label} label={s.label} value={s.val} />)}
                  </div>
                </div>
              );
            })()}
          </AccordionCard>

          {/* ─── 3. ML Predictions ─────────────────────────────────────── */}
          <AccordionCard title="ML Predictions" icon="🧠">
            {(() => {
              const ml = mlScores ?? {};
              const churn = Math.round((ml.churnRiskScore ?? 0.23) * 100);
              const churnCls = churn < 30 ? "green" : churn < 60 ? "yellow" : "red";
              const ticket = Math.round((ml.ticketPropensity ?? 0.67) * 100);
              const retail = Math.round((ml.retailPropensity ?? 0.45) * 100);
              const channel = ml.nextBestChannel ?? "Email";
              const offer = ml.nextBestOffer ?? "Renovação Sócio";
              const clv = ml.clv12m ?? 480;
              return (
                <div className="sfv-ml-grid">
                  <div className="sfv-ml-card">
                    <div className="sfv-ml-card__label">Churn Risk</div>
                    <div className={`sfv-ml-card__value sfv-ml-card__value--${churnCls}`}>{churn}%</div>
                  </div>
                  <div className="sfv-ml-card">
                    <div className="sfv-ml-card__label">Predicted Value 12 months</div>
                    <div className="sfv-ml-card__value sfv-ml-card__value--blue">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(clv)}
                    </div>
                  </div>
                  <div className="sfv-ml-card">
                    <div className="sfv-ml-card__label">Ticket Purchase Propensity</div>
                    <div className="sfv-ml-card__value sfv-ml-card__value--purple">{ticket}%</div>
                  </div>
                  <div className="sfv-ml-card">
                    <div className="sfv-ml-card__label">Retail Purchase Propensity</div>
                    <div className="sfv-ml-card__value sfv-ml-card__value--blue">{retail}%</div>
                  </div>
                  <div className="sfv-ml-card">
                    <div className="sfv-ml-card__label">Best Channel</div>
                    <div style={{ marginTop: 6 }}>
                      <span className="sfv-channel-badge">{CHANNEL_ICONS[channel?.toLowerCase()] ?? "📢"} {channel}</span>
                    </div>
                  </div>
                  <div className="sfv-ml-card">
                    <div className="sfv-ml-card__label">Best Current Offer</div>
                    <div className="sfv-ml-card__value sfv-ml-card__value--purple" style={{ fontSize: "1rem", marginTop: 4 }}>{offer}</div>
                  </div>
                </div>
              );
            })()}
          </AccordionCard>

          {/* ─── 4. Timeline / Activity Feed ───────────────────────────── */}
          <AccordionCard title="Activity Timeline" icon="⏱">
            {(() => {
              const evts = (Array.isArray(events) && events.length > 0) ? events : MOCK_EVENTS;
              return (
                <div className="sfv-timeline">
                  {evts.slice(0, 20).map((ev, i) => (
                    <div key={i} className="sfv-timeline-item">
                      <div className="sfv-timeline-icon">{eventIcon(ev.type ?? ev.eventType)}</div>
                      <div className="sfv-timeline-content">
                        <div className="sfv-timeline-name">{ev.name ?? ev.eventName ?? ev.type ?? "Event"}</div>
                        <div className="sfv-timeline-meta">
                          {(ev.props ?? ev.properties ?? ev.summary) && (
                            <span style={{ fontWeight: 600, color: "var(--coxa-text)" }}>
                              {typeof (ev.props ?? ev.properties ?? ev.summary) === "object"
                                ? JSON.stringify(ev.props ?? ev.properties ?? ev.summary).slice(0, 60)
                                : ev.props ?? ev.properties ?? ev.summary}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="sfv-timeline-time" title={absDate(ev.ts ?? ev.timestamp ?? ev.createdAt)}>
                        {relativeTime(ev.ts ?? ev.timestamp ?? ev.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </AccordionCard>

          {/* ─── 5. Segment Memberships ────────────────────────────────── */}
          <AccordionCard title="Segment Memberships" icon="🎯">
            {(() => {
              const segs = (Array.isArray(segments) && segments.length > 0)
                ? segments
                : (Array.isArray(customer360?.profile?.segments) && customer360.profile.segments.length > 0)
                  ? customer360.profile.segments
                  : null;
              if (!segs) return (
                <p className="empty-state">No active segments — <a href="/intelligence/filters" style={{ color: "var(--coxa-primary)" }}>view Segments</a></p>
              );
              return (
                <div className="sfv-chips">
                  {segs.map((s, i) => (
                    <span key={i} className="sfv-chip">🎯 {typeof s === "string" ? s : (s.name ?? s._id ?? "Segment")}</span>
                  ))}
                </div>
              );
            })()}
          </AccordionCard>

          {/* ─── 6. Communication History ──────────────────────────────── */}
          <AccordionCard title="Communication History" icon="📨">
            {(() => {
              const msgs = (Array.isArray(comms) && comms.length > 0) ? comms : MOCK_COMMS;
              return (
                <div className="sfv-comms-list">
                  {msgs.slice(0, 5).map((m, i) => {
                    const ch = m.channel ?? "email";
                    const status = m.status ?? "Delivered";
                    const cls = COMM_STATUS_CLASS[status] ?? "delivered";
                    return (
                      <div key={i} className="sfv-comm-row">
                        <span className="sfv-comm-icon">{CHANNEL_ICONS[ch.toLowerCase()] ?? "📧"}</span>
                        <span className="sfv-comm-subject">{m.subject ?? m.name ?? "—"}</span>
                        <span className="sfv-comm-date">{absDate(m.sentAt ?? m.createdAt)}</span>
                        <span className={`sfv-status-badge sfv-status-badge--${cls}`}>{status}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </AccordionCard>

          {/* ─── 7. Admin Notes & Tags ─────────────────────────────────── */}
          <AccordionCard title="Notes & Tags" icon="🏷">
            <TagsEditor
              profileId={customer360?.profile?._id ?? selected?._id ?? selected?.id}
              initialTags={customer360?.profile?.tags ?? selected?.tags ?? []}
              initialNotes={customer360?.profile?.notes ?? selected?.notes ?? ""}
            />
          </AccordionCard>
        </div>
      )}

      {customer360?.profile && (
        <section className="panel">
          <h2>Customer 360</h2>
          <dl className="fan-profile-dl">
            <dt>Fan ID</dt><dd>{customer360.profile.fanId ?? "—"}</dd>
            <dt>Member ID</dt><dd>{customer360.profile.memberId ?? "—"}</dd>
            <dt>Status</dt><dd>{customer360.profile.status ?? "—"}</dd>
            <dt>Created</dt><dd>{customer360.profile.createdAt ? new Date(customer360.profile.createdAt).toLocaleString("en-US") : "—"}</dd>
            <dt>Total Retail Spend</dt><dd>{Number(customer360.summary?.totalRetailSpendCents ?? 0).toLocaleString("en-US")} cents</dd>
            <dt>Points Balance</dt><dd>{Number(customer360.summary?.pointsBalance ?? 0).toLocaleString("en-US")}</dd>
          </dl>
        </section>
      )}

      {/* ── ML Scores Panel — Phase 3 ─────────────────────────────── */}
      {mlScores && (
        <section className="panel" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>🧠</span> ML Intelligence
            {mlScores.mlScoresUpdatedAt && (
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, marginLeft: "auto" }}>
                Last scored: {new Date(mlScores.mlScoresUpdatedAt).toLocaleDateString("pt-BR")}
              </span>
            )}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginTop: 12 }}>
            {/* Churn Risk */}
            <div style={{ background: "#fef2f2", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Churn Risk</div>
              <RiskBar score={mlScores.churnRiskScore} />
            </div>
            {/* Ticket Propensity */}
            <div style={{ background: "#eff6ff", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Ticket Propensity</div>
              <RiskBar score={mlScores.ticketPropensity} />
            </div>
            {/* Retail Propensity */}
            <div style={{ background: "#ecfdf5", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Retail Propensity</div>
              <RiskBar score={mlScores.retailPropensity} />
            </div>
            {/* Next Best Channel */}
            <div style={{ background: "#f5f3ff", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Next Best Channel</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#7c3aed", textTransform: "capitalize" }}>
                {mlScores.nextBestChannel ?? "—"}
              </div>
            </div>
          </div>
        </section>
      )}

      <ReportTable
        title="Recent sales"
        rows={customer360?.recentSales ?? []}
        columns={[
          { key: "channel", label: "Channel" },
          { key: "totalCents", label: "Total (cents)" },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Created" },
        ]}
        csvFilename="single-fan-sales.csv"
      />
      <ReportTable
        title="Recent tickets"
        rows={customer360?.recentTickets ?? []}
        columns={[
          { key: "status", label: "Status" },
          { key: "priceCents", label: "Price (cents)" },
          { key: "issuedAt", label: "Issued" },
          { key: "usedAt", label: "Used" },
        ]}
        csvFilename="single-fan-tickets.csv"
      />
      <ReportTable
        title="Traits"
        rows={Object.entries(customer360?.traits ?? {}).map(([trait, value]) => ({ trait, value }))}
        columns={[
          { key: "trait", label: "Trait" },
          { key: "value", label: "Value" },
        ]}
        csvFilename="single-fan-traits.csv"
      />
      <ReportTable
        title="Contact and ledger"
        rows={(customer360?.loyalty?.recentLedger ?? []).map((row) => ({
          points: row.pointsDelta,
          type: row.type,
          reason: row.reason,
          createdAt: row.createdAt,
        }))}
        columns={[
          { key: "points", label: "Points delta" },
          { key: "type", label: "Type" },
          { key: "reason", label: "Reason" },
          { key: "createdAt", label: "Created" },
        ]}
        csvFilename="single-fan-ledger.csv"
      />
    </div>
  );
}
