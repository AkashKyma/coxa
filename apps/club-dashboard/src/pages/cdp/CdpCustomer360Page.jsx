import { useState } from "react";
import { api, formatBrl } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import DataTable from "@coxa/ui/DataTable";
import { useClubAnalytics } from "../../lib/useClubAnalytics.js";
import { X, Edit2 } from "lucide-react";

function initials(name) {
  return (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Toast({ msg, type = "success", onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        background: type === "error" ? "#dc2626" : "#0C6B3A",
        color: "#fff", padding: "12px 20px", borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontSize: 13, fontWeight: 500,
        cursor: "pointer", maxWidth: 360,
      }}
    >
      {msg}
    </div>
  );
}

const EMPTY_EDIT = {
  fullName: "", email: "", phone: "", dateOfBirth: "", gender: "",
  favoritePlayer: "", jerseySize: "", preferredLanguage: "pt-BR",
  notes: "", tagsInput: "",
};

function profileToEdit(p) {
  if (!p) return EMPTY_EDIT;
  const dob = p.dateOfBirth ?? p.birthDate;
  return {
    fullName: p.fullName ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    dateOfBirth: dob ? new Date(dob).toISOString().slice(0, 10) : "",
    gender: p.gender ?? "",
    favoritePlayer: p.favoritePlayer ?? "",
    jerseySize: p.jerseySize ?? "",
    preferredLanguage: p.preferredLanguage ?? "pt-BR",
    notes: p.notes ?? "",
    tagsInput: (p.tags ?? []).join(", "),
  };
}

function EditDrawer({ profile, onClose, onSaved }) {
  const [form, setForm] = useState(() => profileToEdit(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tags = form.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const body = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        favoritePlayer: form.favoritePlayer || undefined,
        jerseySize: form.jerseySize || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        notes: form.notes || undefined,
        tags,
      };
      const profileId = profile._id ?? profile.id;
      await api.editFanProfile(profileId, body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const drawerStyle = {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
    background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
    zIndex: 8000, display: "flex", flexDirection: "column",
    overflowY: "auto",
  };

  const fieldStyle = {
    width: "100%", padding: "8px 10px",
    border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13,
    boxSizing: "border-box", outline: "none",
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 7999 }}
        onClick={onClose}
      />
      <div style={drawerStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Edit Profile</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ margin: "12px 24px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
            {error}
          </div>
        )}

        <form id="edit-fan-form" onSubmit={handleSubmit} style={{ padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { name: "fullName", label: "Full name", type: "text" },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "dateOfBirth", label: "Date of birth", type: "date" },
            { name: "favoritePlayer", label: "Favourite player", type: "text" },
          ].map(({ name, label, type }) => (
            <div key={name}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
              <input type={type} name={name} value={form[name]} onChange={handleChange} style={fieldStyle} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Gender</label>
            <select name="gender" value={form.gender} onChange={handleChange} style={fieldStyle}>
              <option value="">— Select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="non_binary">Non-binary</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Jersey size</label>
            <select name="jerseySize" value={form.jerseySize} onChange={handleChange} style={fieldStyle}>
              <option value="">— Select —</option>
              {["PP", "P", "M", "G", "GG", "XGG"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Preferred language</label>
            <select name="preferredLanguage" value={form.preferredLanguage} onChange={handleChange} style={fieldStyle}>
              <option value="pt-BR">Portuguese (Brazil)</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Tags (comma-separated)</label>
            <input
              name="tagsInput"
              value={form.tagsInput}
              onChange={handleChange}
              placeholder="vip, active, premium-member"
              style={fieldStyle}
            />
            {form.tagsInput && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {form.tagsInput.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                  <span key={tag} style={{
                    background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0",
                    borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 500,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Internal notes (max. 1000 chars)</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              maxLength={1000}
              rows={4}
              style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Internal notes about the fan…"
            />
            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>{form.notes.length}/1000</div>
          </div>
        </form>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
          <button type="submit" form="edit-fan-form" className="btn btn--primary btn--sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function CdpCustomer360Page() {
  const { track } = useClubAnalytics();
  const [query, setQuery] = useState("fan@coxa.local");
  const [data, setData] = useState(null);
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleSearch(e) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    setOffer(null);
    try {
      const c360 = await api.customer360(query);
      setData(c360.data);
      track("customer360_searched", {
        queryType: query.includes("@") ? "email" : "id",
        segmentCount: c360.data?.segments?.length ?? 0,
        hasOffer: Boolean(c360.data?.profile?.id),
      });
      if (c360.data?.profile?.id) {
        const offerRes = await api.nextBestOffer(c360.data.profile.id);
        setOffer(offerRes.data);
      }
    } catch (err) {
      track("customer360_search_failed", { error: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSaved() {
    setEditOpen(false);
    setToast({ msg: "Profile updated", type: "success" });
    await handleSearch();
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        module="Marketing & CDP"
        title="Customer 360"
        description="Unified fan profile with traits, segments, loyalty balance, recent activity and personalized offers."
      />

      <form className="search-bar" onSubmit={handleSearch}>
        <div className="form-group">
          <label>Search by email, fan ID or profile ID</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="fan@coxa.local"
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? "Searching…" : "Search fan"}
        </button>
      </form>

      {error && <div className="alert error">{error}</div>}

      {data && (
        <>
          <div className="c360-hero">
            <div className="c360-avatar">{initials(data.profile.fullName)}</div>
            <div className="c360-hero__info" style={{ flex: 1 }}>
              <h2>{data.profile.fullName}</h2>
              <div className="c360-hero__meta">
                <span>{data.profile.email}</span>
                <span>Fan ID: <code>{data.profile.fanId}</code></span>
                {data.profile.memberId && <span>Member: {data.profile.memberId}</span>}
              </div>
              {data.profile.tags?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {data.profile.tags.map((tag) => (
                    <span key={tag} style={{
                      background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0",
                      borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 500,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ marginLeft: "auto", alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5 }}
              onClick={() => setEditOpen(true)}
            >
              <Edit2 size={13} strokeWidth={2} />
              Edit Profile
            </button>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card kpi-card--accent">
              <span className="kpi-card__value">{formatBrl(data.summary.totalRetailSpendCents)}</span>
              <span className="kpi-card__label">Retail spend</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__value">{data.summary.purchaseCount}</span>
              <span className="kpi-card__label">Purchases</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__value">{data.summary.pointsBalance.toLocaleString()}</span>
              <span className="kpi-card__label">Loyalty points</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__value">{data.summary.ticketCount ?? 0}</span>
              <span className="kpi-card__label">Tickets bought</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__value">{data.summary.attendanceCount ?? 0}</span>
              <span className="kpi-card__label">Match attendance</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__value">{data.summary.segmentCount}</span>
              <span className="kpi-card__label">Segments</span>
            </div>
          </div>

          <div className="c360-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--coxa-space-4)" }}>
              <div className="panel-card">
                <div className="panel-card__head">
                  <h3>Computed traits</h3>
                  <p>Updated automatically from the event stream</p>
                </div>
                <div className="panel-card__body">
                  {Object.keys(data.traits ?? {}).length === 0 ? (
                    <p className="link-muted">No traits computed yet.</p>
                  ) : (
                    <div className="trait-grid">
                      {Object.entries(data.traits ?? {}).map(([key, val]) => (
                        <span key={key} className="trait-pill">
                          <code>{key}</code>
                          <strong>{String(val)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-card__head">
                  <h3>Segment membership</h3>
                </div>
                <div className="panel-card__body">
                  {data.segments?.length ? (
                    data.segments.map((s) => (
                      <span key={s.id} className="segment-tag">{s.name}</span>
                    ))
                  ) : (
                    <p className="link-muted">Not in any active segment.</p>
                  )}
                </div>
              </div>

              {data.profile.notes && (
                <div className="panel-card">
                  <div className="panel-card__head">
                    <h3>Internal notes</h3>
                  </div>
                  <div className="panel-card__body">
                    <p style={{ fontSize: 13, color: "var(--coxa-text, #1e293b)", whiteSpace: "pre-wrap", margin: 0 }}>{data.profile.notes}</p>
                  </div>
                </div>
              )}

              {offer?.offer && (
                <div className="offer-card">
                  <span className="offer-card__tag">Next best offer</span>
                  <h3>{offer.offer.title}</h3>
                  <p>{offer.offer.description}</p>
                  {offer.matchedSegment && (
                    <p className="link-muted" style={{ marginTop: "0.75rem" }}>
                      Matched: {offer.matchedSegment}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--coxa-space-4)" }}>
              <div className="panel-card">
                <div className="panel-card__head">
                  <h3>Recent events</h3>
                </div>
                <div className="panel-card__body panel-card__body--flush">
                  <DataTable
                    columns={[
                      {
                        key: "time",
                        header: "Time",
                        render: (ev) => new Date(ev.eventTimestamp).toLocaleString(),
                      },
                      {
                        key: "event",
                        header: "Event",
                        render: (ev) => <span className="event-name">{ev.eventName}</span>,
                      },
                      { key: "source", header: "Source" },
                    ]}
                    data={data.recentEvents ?? []}
                    pagination={false}
                    className="coxa-data-table-wrapper--flush"
                    emptyMessage="No events"
                  />
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-card__head">
                  <h3>Recent tickets</h3>
                </div>
                <div className="panel-card__body panel-card__body--flush">
                  <DataTable
                    columns={[
                      {
                        key: "event",
                        header: "Event",
                        render: (t) => t.matchEventId?.title ?? "—",
                      },
                      {
                        key: "product",
                        header: "Product",
                        render: (t) => t.ticketProductId?.name ?? "—",
                      },
                      { key: "status", header: "Status" },
                    ]}
                    data={data.recentTickets ?? []}
                    pagination={false}
                    className="coxa-data-table-wrapper--flush"
                    emptyMessage="No tickets"
                  />
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-card__head">
                  <h3>Loyalty ledger</h3>
                </div>
                <div className="panel-card__body panel-card__body--flush">
                  <DataTable
                    columns={[
                      {
                        key: "date",
                        header: "Date",
                        render: (entry) => new Date(entry.createdAt).toLocaleDateString(),
                      },
                      { key: "type", header: "Type", render: (entry) => entry.entryType },
                      {
                        key: "points",
                        header: "Points",
                        render: (entry) => (
                          <span className={entry.pointsDelta > 0 ? "ledger-positive" : "ledger-negative"}>
                            {entry.pointsDelta > 0 ? `+${entry.pointsDelta}` : entry.pointsDelta}
                          </span>
                        ),
                      },
                      {
                        key: "balance",
                        header: "Balance",
                        render: (entry) => entry.balanceAfter.toLocaleString(),
                      },
                    ]}
                    data={data.loyalty?.recentLedger ?? []}
                    pagination={false}
                    className="coxa-data-table-wrapper--flush"
                    emptyMessage="No ledger entries"
                  />
                </div>
              </div>
            </div>
          </div>

          {editOpen && (
            <EditDrawer
              profile={data.profile}
              onClose={() => setEditOpen(false)}
              onSaved={handleProfileSaved}
            />
          )}
        </>
      )}
    </div>
  );
}
