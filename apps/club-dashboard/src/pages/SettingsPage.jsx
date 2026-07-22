import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Settings, Activity, Key, RefreshCw, CheckCircle, XCircle, Bell, AlertTriangle, Download } from "lucide-react";

const NOTIF_KEY = "coxa_club_settings_notifications";

function loadNotifSettings() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function StatusDot({ ok }) {
  return ok ? (
    <CheckCircle size={14} strokeWidth={2} color="#16a34a" />
  ) : (
    <XCircle size={14} strokeWidth={2} color="#dc2626" />
  );
}

function ServiceRow({ label, url, statusKey, statuses }) {
  const s = statuses[statusKey];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
      <StatusDot ok={s?.ok} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
      {url && <span style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>{url}</span>}
      {s?.latencyMs != null && (
        <span style={{ fontSize: 11, color: "#6b7280" }}>{s.latencyMs}ms</span>
      )}
      {s == null && <span style={{ fontSize: 11, color: "#9ca3af" }}>Checking…</span>}
    </div>
  );
}

function Toast({ msg, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "error" ? "#dc2626" : "#0C6B3A",
      color: "#fff", padding: "12px 20px", borderRadius: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontSize: 13, fontWeight: 500,
      maxWidth: 360,
    }}>
      {msg}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 0", borderBottom: "1px solid var(--coxa-border, #f1f5f9)" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11, position: "relative", cursor: "pointer",
          background: checked ? "var(--coxa-primary, #0C6B3A)" : "#e5e7eb",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--coxa-text, #1e293b)" }}>{label}</span>
    </label>
  );
}

export default function SettingsPage() {
  const [club, setClub] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [checkingServices, setCheckingServices] = useState(false);
  const [toast, setToast] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [exportModal, setExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const logoRef = useRef(null);

  const [form, setForm] = useState({
    clubName: "",
    country: "",
    city: "",
    website: "",
    sport: "",
    stadiumName: "",
    tagline: "",
    primaryColor: "#0C6B3A",
    timezone: "America/Sao_Paulo",
    language: "pt-BR",
  });

  const [notifSettings, setNotifSettings] = useState({
    emailNewMember: false,
    emailDailyReport: false,
    pushEnabled: false,
    loyaltyThresholdAlert: false,
    loyaltyThreshold: 100,
    ...loadNotifSettings(),
  });

  useEffect(() => {
    api.listMyClubs()
      .then((r) => {
        const entry = (r.data?.clubs ?? r.data ?? r)[0];
        const club = entry?.club ?? entry;
        if (club) {
          setClub(club);
          setForm((f) => ({
            ...f,
            clubName: club.name ?? "",
            country: club.country ?? "",
            city: club.city ?? "",
            website: club.website ?? "",
            sport: club.sport ?? "",
            stadiumName: club.stadiumName ?? "",
          }));
        }
      })
      .catch(() => {});
    checkServices();
  }, []);

  async function checkServices() {
    setCheckingServices(true);
    const checks = {
      backend: "/api/health",
      rudderstack: `${import.meta.env.VITE_RUDDERSTACK_URL ?? ""}/health`,
      posthog: `${import.meta.env.VITE_POSTHOG_HOST ?? ""}/api/users/@me`,
      clickhouse: "/api/v1/cdp/clickhouse/health",
      cube: "/api/v1/cdp/cube/health",
      tracardi: "/api/v1/cdp/tracardi/health",
    };

    const results = {};
    await Promise.all(
      Object.entries(checks).map(async ([key, url]) => {
        if (!url || url.startsWith("/api")) {
          try {
            const t0 = Date.now();
            const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
            results[key] = { ok: res.ok, latencyMs: Date.now() - t0 };
          } catch {
            results[key] = { ok: false };
          }
        } else {
          results[key] = { ok: null };
        }
      })
    );
    setStatuses(results);
    setCheckingServices(false);
  }

  function handleChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!club) return;
    setSaving(true);
    try {
      try {
        await fetch("/api/v1/clubs/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("coxa_token")}` },
          body: JSON.stringify({
            name: form.clubName,
            tagline: form.tagline,
            primaryColor: form.primaryColor,
            timezone: form.timezone,
            language: form.language,
          }),
        });
        setToast({ msg: "Settings saved successfully", type: "success" });
      } catch {
        localStorage.setItem("coxa_club_settings", JSON.stringify(form));
        setToast({ msg: "Settings saved locally", type: "success" });
      }
      await api.updateClub(club.id ?? club._id, {
        name: form.clubName.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        website: form.website.trim() || undefined,
        sport: form.sport.trim() || undefined,
        stadiumName: form.stadiumName.trim() || undefined,
      }).catch(() => {});
      setEditing(false);
    } catch (err) {
      setToast({ msg: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function saveNotifSettings(next) {
    setNotifSettings(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    setToast({ msg: "Notifications saved locally", type: "success" });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/v1/exports/all", {
        headers: { Authorization: `Bearer ${localStorage.getItem("coxa_token")}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 404) {
        setToast({ msg: "Export not available at the moment", type: "error" });
      } else if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "coxa-export.json";
        a.click();
        URL.revokeObjectURL(url);
        setToast({ msg: "Export started", type: "success" });
      } else {
        setToast({ msg: "Export not available at the moment", type: "error" });
      }
    } catch {
      setToast({ msg: "Export not available at the moment", type: "error" });
    } finally {
      setExporting(false);
      setExportModal(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb",
    borderRadius: 8, fontSize: 13, background: editing ? "#fff" : "#f8fafc", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div className="page">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div className="page-header__left">
          <Settings size={20} strokeWidth={2} />
          <div>
            <h1>Settings</h1>
            <p className="page-header__sub">Club profile, integrations, and service health</p>
          </div>
        </div>
      </div>

      {/* ── Club Profile ───────────────────────────────── */}
      <div className="card mb-4">
        <div className="card__header">
          <Settings size={15} strokeWidth={2} />
          <h2>Club Profile</h2>
          <div style={{ marginLeft: "auto" }}>
            {!editing ? (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
                <button type="button" className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save Settings"}
                </button>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", padding: "4px 0 16px" }}>
            {[
              { name: "clubName", label: "Club name" },
              { name: "sport", label: "Sport" },
              { name: "city", label: "City" },
              { name: "country", label: "Country" },
              { name: "stadiumName", label: "Stadium / Arena" },
              { name: "website", label: "Website" },
            ].map(({ name, label }) => (
              <div key={name}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
                <input name={name} value={form[name]} onChange={handleChange} disabled={!editing} style={inputStyle} />
              </div>
            ))}

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Tagline / Description (max. 200 chars)</label>
              <textarea
                name="tagline"
                value={form.tagline}
                onChange={handleChange}
                disabled={!editing}
                maxLength={200}
                rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>{form.tagline.length}/200</div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Primary colour</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="color"
                  name="primaryColor"
                  value={form.primaryColor}
                  onChange={handleChange}
                  disabled={!editing}
                  style={{ width: 40, height: 34, border: "1.5px solid #e5e7eb", borderRadius: 6, cursor: editing ? "pointer" : "default", padding: 2 }}
                />
                <input
                  name="primaryColor"
                  value={form.primaryColor}
                  onChange={handleChange}
                  disabled={!editing}
                  style={{ ...inputStyle, width: 120 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Logo</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {logoPreview && (
                  <img src={logoPreview} alt="Logo preview" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6, border: "1px solid #e5e7eb" }} />
                )}
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => logoRef.current?.click()}
                  disabled={!editing}
                >
                  {logoPreview ? "Change logo" : "Upload logo"}
                </button>
                <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Default timezone</label>
              <select name="timezone" value={form.timezone} onChange={handleChange} disabled={!editing} style={inputStyle}>
                <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                <option value="America/Manaus">America/Manaus</option>
                <option value="America/Belem">America/Belem</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Default language</label>
              <select name="language" value={form.language} onChange={handleChange} disabled={!editing} style={inputStyle}>
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* ── Notification Settings ───────────────────────── */}
      <div className="card mb-4">
        <div className="card__header">
          <Bell size={15} strokeWidth={2} />
          <h2>Notification Settings</h2>
        </div>
        <div style={{ padding: "4px 0 8px" }}>
          <Toggle
            label="Email for new member registrations"
            checked={notifSettings.emailNewMember}
            onChange={(v) => saveNotifSettings({ ...notifSettings, emailNewMember: v })}
          />
          <Toggle
            label="Email for daily reports"
            checked={notifSettings.emailDailyReport}
            onChange={(v) => saveNotifSettings({ ...notifSettings, emailDailyReport: v })}
          />
          <Toggle
            label="Push notifications enabled"
            checked={notifSettings.pushEnabled}
            onChange={(v) => saveNotifSettings({ ...notifSettings, pushEnabled: v })}
          />
          <Toggle
            label="Alert when loyalty points fall below threshold"
            checked={notifSettings.loyaltyThresholdAlert}
            onChange={(v) => saveNotifSettings({ ...notifSettings, loyaltyThresholdAlert: v })}
          />
          {notifSettings.loyaltyThresholdAlert && (
            <div style={{ paddingTop: 10, paddingLeft: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Points threshold</label>
              <input
                type="number"
                min={0}
                value={notifSettings.loyaltyThreshold}
                onChange={(e) => saveNotifSettings({ ...notifSettings, loyaltyThreshold: Number(e.target.value) })}
                style={{ width: 120, padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Integration keys ───────────────────────────── */}
      <div className="card mb-4">
        <div className="card__header">
          <Key size={15} strokeWidth={2} />
          <h2>Integration keys</h2>
        </div>
        <div style={{ padding: "4px 0" }}>
          {[
            { label: "RudderStack Write Key", envKey: "VITE_RUDDERSTACK_WRITE_KEY" },
            { label: "PostHog Project API Key", envKey: "VITE_POSTHOG_KEY" },
            { label: "PostHog Host", envKey: "VITE_POSTHOG_HOST" },
          ].map(({ label, envKey }) => {
            const val = import.meta.env[envKey];
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                <StatusDot ok={!!val} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: val ? "#16a34a" : "#dc2626" }}>
                  {val ? `${String(val).substring(0, 8)}…` : "Not set"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Service health ────────────────────────────── */}
      <div className="card mb-4">
        <div className="card__header">
          <Activity size={15} strokeWidth={2} />
          <h2>Service health</h2>
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }} onClick={checkServices} disabled={checkingServices}>
            <RefreshCw size={12} strokeWidth={2} style={{ marginRight: 4 }} />
            {checkingServices ? "Checking…" : "Refresh"}
          </button>
        </div>
        <div style={{ padding: "4px 0" }}>
          <ServiceRow label="Backend API" url="api.coxa.live" statusKey="backend" statuses={statuses} />
          <ServiceRow label="RudderStack" url="rudder.service.coxa.live" statusKey="rudderstack" statuses={statuses} />
          <ServiceRow label="PostHog" url="posthog.service.coxa.live" statusKey="posthog" statuses={statuses} />
          <ServiceRow label="ClickHouse" url="EC2 :8123" statusKey="clickhouse" statuses={statuses} />
          <ServiceRow label="Cube (Semantic Layer)" url="cube.service.coxa.live" statusKey="cube" statuses={statuses} />
          <ServiceRow label="Tracardi" url="tracardi-api.service.coxa.live" statusKey="tracardi" statuses={statuses} />
        </div>
      </div>

      {/* ── Danger Zone ───────────────────────────────── */}
      <div className="card" style={{ border: "1.5px solid #dc2626" }}>
        <div className="card__header" style={{ borderBottom: "1px solid #fee2e2" }}>
          <AlertTriangle size={15} strokeWidth={2} color="#dc2626" />
          <h2>Danger Zone</h2>
        </div>
        <div style={{ padding: "16px 0 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--coxa-text, #1e293b)" }}>Export all data</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Downloads a JSON file with all club data. This operation may take a while.</div>
          </div>
          <button
            type="button"
            className="btn btn--sm"
            style={{ background: "#dc2626", color: "#fff", border: "none", cursor: "pointer" }}
            onClick={() => setExportModal(true)}
          >
            <Download size={13} strokeWidth={2} style={{ marginRight: 5 }} />
            Export all data
          </button>
        </div>
      </div>

      {/* ── Export Confirmation Modal ─────────────────── */}
      {exportModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setExportModal(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 12, padding: 28, width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={20} color="#dc2626" />
              <h3 style={{ margin: 0, fontSize: 16 }}>Confirm export</h3>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>
              You are about to export all club data, including fan profiles, transactions and settings. Confirm to continue.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setExportModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn--sm"
                style={{ background: "#dc2626", color: "#fff", border: "none", cursor: "pointer" }}
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exporting…" : "Confirm export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
