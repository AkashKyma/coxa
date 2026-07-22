import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import { ActivitySquare, Users, CheckCircle2, XCircle, RefreshCw, Clock, Trophy } from "lucide-react";
import { useClubAnalytics } from "../../lib/useClubAnalytics.js";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${color ?? "blue"}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value ?? "â€”"}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
}

function windowStatusClass(status) {
  if (status === "open") return "event-status--sale";
  if (status === "closed") return "event-status--cancelled";
  return "event-status--draft";
}

export default function CheckInDashboardPage() {
  const { track } = useClubAnalytics();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [stats, setStats] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Member check-in window state
  const [windows, setWindows] = useState([]);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [showWindowForm, setShowWindowForm] = useState(false);
  const [windowForm, setWindowForm] = useState({
    name: "",
    membershipPlanId: "",
    opensAt: "",
    closesAt: "",
    capacity: 500,
    fanScoreMin: 0,
  });
  const [windowSaving, setWindowSaving] = useState(false);
  const [windowError, setWindowError] = useState(null);

  useEffect(() => {
    api.listMatchEvents({ limit: 20 })
      .then((r) => {
        const evts = r.data?.events ?? [];
        setEvents(evts);
        if (evts.length) setSelectedEventId(evts[0]._id ?? evts[0].id);
      })
      .catch(() => {});
    api.listMembershipPlans()
      .then((r) => setPlans(r.data ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!selectedEventId) return;
    setLoading(true);
    api.listEventTickets(selectedEventId)
      .then((r) => {
        const tickets = r.data?.tickets ?? [];
        const admitted = tickets.filter((t) => t.status === "used").length;
        setStats({ total: tickets.length, admitted, remaining: tickets.length - admitted });
        setRecentScans(
          tickets.filter((t) => t.status === "used").slice(0, 15).map((t) => ({
            ts: t.usedAt ?? t.updatedAt ?? new Date().toISOString(),
            qrToken: t.qrToken,
            fanName: t.fanName ?? t.holderName,
            gate: t.gateId ?? "GATE-A",
            result: "valid",
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  const loadWindows = useCallback(() => {
    if (!selectedEventId) return;
    setWindowsLoading(true);
    api.listCheckInWindows(selectedEventId)
      .then((r) => setWindows(r.data ?? []))
      .catch(() => {})
      .finally(() => setWindowsLoading(false));
  }, [selectedEventId]);

  useEffect(() => { load(); loadWindows(); }, [load, loadWindows]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { load(); loadWindows(); }, 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, load, loadWindows]);

  async function handleValidate(e) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setValidating(true);
    setScanResult(null);
    try {
      const res = await api.validateEntitlement(manualToken.trim(), {
        markUsed: false,
        matchEventId: selectedEventId || undefined,
      });
      setScanResult({ ok: true, data: res.data });
      track("checkin_qr_validated", {
        matchEventId: selectedEventId,
        result: "valid",
        fanId: res.data?.ticket?.fanProfileId,
      });
    } catch (err) {
      setScanResult({ ok: false, message: err.message });
      track("checkin_qr_validated", {
        matchEventId: selectedEventId,
        result: "invalid",
        error: err.message,
      });
    } finally {
      setValidating(false);
    }
  }

  async function handleSyncWindows() {
    if (!selectedEventId) return;
    setSyncing(true);
    try {
      await api.syncCheckInWindows(selectedEventId);
      track("checkin_windows_synced", { matchEventId: selectedEventId });
      loadWindows();
    } catch (err) {
      setWindowError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  function wset(field) {
    return (e) => setWindowForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleCreateWindow(e) {
    e.preventDefault();
    setWindowSaving(true);
    setWindowError(null);
    try {
      await api.createCheckInWindow({
        matchEventId: selectedEventId,
        membershipPlanId: windowForm.membershipPlanId,
        name: windowForm.name,
        opensAt: new Date(windowForm.opensAt).toISOString(),
        closesAt: new Date(windowForm.closesAt).toISOString(),
        capacity: Number(windowForm.capacity),
        fanScoreMin: Number(windowForm.fanScoreMin) || 0,
      });
      track("checkin_window_created", {
        matchEventId: selectedEventId,
        windowName: windowForm.name,
        capacity: Number(windowForm.capacity),
        fanScoreMin: Number(windowForm.fanScoreMin) || 0,
      });
      setShowWindowForm(false);
      setWindowForm({ name: "", membershipPlanId: "", opensAt: "", closesAt: "", capacity: 500, fanScoreMin: 0 });
      loadWindows();
    } catch (err) {
      setWindowError(err.message);
    } finally {
      setWindowSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <ActivitySquare size={22} strokeWidth={2} />
          <div>
            <h1>Check-in dashboard</h1>
            <p className="page-header__sub">Live gate entry monitoring</p>
          </div>
        </div>
        <div className="page-header__actions">
          <select
            className="input input--sm"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{ minWidth: 200 }}
          >
            {events.length === 0 && <option value="">No events</option>}
            {events.map((ev) => (
              <option key={ev._id ?? ev.id} value={ev._id ?? ev.id}>
                {ev.name ?? ev.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`btn btn--secondary btn--sm${autoRefresh ? " btn--primary" : ""}`}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <RefreshCw size={13} strokeWidth={2} style={autoRefresh ? { animation: "spin 1.5s linear infinite" } : {}} />
            {autoRefresh ? "Live â—" : "Auto-refresh"}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-row">
          <StatCard icon={Users} label="Tickets issued" value={stats.total} color="blue" />
          <StatCard icon={CheckCircle2} label="Admitted" value={stats.admitted} color="green" />
          <StatCard icon={XCircle} label="Remaining" value={stats.remaining} color="orange" />
          <StatCard
            icon={ActivitySquare}
            label="Occupancy"
            value={stats.total ? `${Math.round((stats.admitted / stats.total) * 100)}%` : "0%"}
            color="purple"
          />
        </div>
      )}

      <div className="page-grid page-grid--2col">
        <div className="card">
          <div className="card__header">
            <CheckCircle2 size={16} strokeWidth={2} />
            <h2>Quick QR lookup</h2>
          </div>
          <form onSubmit={handleValidate} className="inline-form">
            <input
              type="text"
              className="input"
              placeholder="Paste QR token to verifyâ€¦"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
            <button type="submit" className="btn btn--primary" disabled={validating}>
              {validating ? "Checkingâ€¦" : "Check"}
            </button>
          </form>

          {scanResult && (
            <div className={`alert ${scanResult.ok ? "alert--success" : "alert--error"} mt-2`}>
              {scanResult.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <span>
                {scanResult.ok
                  ? `Valid â€” ${scanResult.data?.ticket?.fanName ?? "Ticket OK"}`
                  : scanResult.message}
              </span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <ActivitySquare size={16} strokeWidth={2} />
            <h2>Recent scans</h2>
            <span className="badge badge--gray">{recentScans.length}</span>
          </div>
          {loading ? (
            <p className="loading-text" style={{ padding: "1rem 0" }}>Loadingâ€¦</p>
          ) : recentScans.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem 0" }}>
              <p>No admissions recorded yet.</p>
            </div>
          ) : (
            <div className="table-wrapper table-wrapper--sm">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Token</th>
                    <th>Fan</th>
                    <th>Gate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((s, i) => (
                    <tr key={i}>
                      <td className="link-muted">{new Date(s.ts).toLocaleTimeString()}</td>
                      <td><code className="code-token">{s.qrToken?.slice(0, 10)}â€¦</code></td>
                      <td>{s.fanName ?? "â€”"}</td>
                      <td>{s.gate}</td>
                      <td><span className="badge badge--green">{s.result}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ Member check-in windows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="panel-card" style={{ marginTop: "2rem" }}>
        <div className="panel-card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Trophy size={16} strokeWidth={2} />
              Member check-in windows
            </h3>
            <p style={{ margin: "0.25rem 0 0", color: "var(--coxa-text-muted)", fontSize: "0.85rem" }}>
              Priority windows gated by fan score â€” higher tier members get earlier access
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleSyncWindows}
              disabled={syncing || !selectedEventId}
            >
              <Clock size={13} strokeWidth={2} />
              {syncing ? "Syncingâ€¦" : "Sync status"}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setShowWindowForm((v) => !v)}
              disabled={!selectedEventId}
            >
              {showWindowForm ? "Cancel" : "+ Add window"}
            </button>
          </div>
        </div>

        {windowError && <div className="alert error" style={{ margin: "0 1rem" }}>{windowError}</div>}

        {showWindowForm && (
          <form onSubmit={handleCreateWindow} className="form-grid" style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--coxa-border)" }}>
            <div className="form-field form-field--full">
              <label className="field-label">Window name *</label>
              <input required value={windowForm.name} onChange={wset("name")} placeholder="Diamond & Platinum window" />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Membership plan *</label>
              <select required value={windowForm.membershipPlanId} onChange={wset("membershipPlanId")}>
                <option value="">â€” Select plan â€”</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.planCode})</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Opens at *</label>
              <input type="datetime-local" required value={windowForm.opensAt} onChange={wset("opensAt")} />
            </div>
            <div className="form-field">
              <label className="field-label">Closes at *</label>
              <input type="datetime-local" required value={windowForm.closesAt} onChange={wset("closesAt")} />
            </div>
            <div className="form-field">
              <label className="field-label">Capacity</label>
              <input type="number" min="1" value={windowForm.capacity} onChange={wset("capacity")} />
            </div>
            <div className="form-field">
              <label className="field-label">Min fan score</label>
              <input type="number" min="0" value={windowForm.fanScoreMin} onChange={wset("fanScoreMin")} placeholder="0 = any member" />
            </div>
            <div className="form-field form-field--full" style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn btn--primary" disabled={windowSaving}>
                {windowSaving ? "Creatingâ€¦" : "Create window"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowWindowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="panel-card__body">
          {windowsLoading ? (
            <p style={{ padding: "1rem" }}>Loading windowsâ€¦</p>
          ) : windows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">No member windows configured</p>
              <p className="empty-state__desc">Add priority check-in windows to control access by fan score tier.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--coxa-border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Window</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Plan</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Min score</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Opens</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Closes</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Capacity</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w) => (
                  <tr key={w.id} style={{ borderBottom: "1px solid var(--coxa-border)" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 600 }}>{w.name}</td>
                    <td style={{ padding: "0.5rem" }}>{w.membershipPlanId?.planCode ?? w.membershipPlanId?.name ?? "â€”"}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{(w.fanScoreMin ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "0.5rem" }}>{new Date(w.opensAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</td>
                    <td style={{ padding: "0.5rem" }}>{new Date(w.closesAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{(w.checkedInCount ?? 0).toLocaleString()} / {(w.capacity ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <span className={`status-pill ${windowStatusClass(w.status)}`}>{w.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
