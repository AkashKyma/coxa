import { useState } from "react";
import { api } from "../../lib/api.js";
import { LifeBuoy, Search, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";

function ResultPanel({ result }) {
  if (!result) return null;
  return (
    <div className={`card card--bordered mt-3 ${result.ok ? "card--success" : "card--error"}`}>
      <div className="card__header" style={{ paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
        {result.ok
          ? <CheckCircle2 size={16} className="text-green" />
          : <XCircle size={16} className="text-red" />}
        <h3 style={{ fontSize: "0.9rem" }}>{result.ok ? "Found" : "Not found"}</h3>
      </div>
      {result.ok && result.data ? (
        <dl className="detail-list">
          {[
            ["Fan", result.data.ticket?.fanName ?? result.data.holderName],
            ["Email", result.data.ticket?.fanEmail],
            ["Seat", result.data.ticket?.seatInfo],
            ["Status", result.data.ticket?.status],
            ["Event", result.data.ticket?.matchEventId],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="detail-list__row">
              <dt>{k}</dt>
              <dd>
                {k === "Status"
                  ? <span className={`badge badge--${v === "used" ? "green" : "blue"}`}>{v}</span>
                  : v}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted text-sm">{result.message}</p>
      )}
    </div>
  );
}

export default function TicketingSupportPage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);

  const [overrideToken, setOverrideToken] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [overrideResult, setOverrideResult] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const isToken = /^[0-9a-f]{32,64}$/i.test(query.trim());
      if (isToken) {
        const res = await api.validateEntitlement(query.trim(), { markUsed: false });
        setResult({ ok: true, data: res.data });
      } else {
        const res = await api.customer360(query.trim());
        const profile = res.data?.profile;
        setResult({
          ok: !!profile,
          data: profile ? { ticket: { fanName: profile.fullName, fanEmail: profile.email, status: "profile" } } : null,
          message: "No fan found for that email.",
        });
      }
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setSearching(false);
    }
  }

  async function handleOverride(e) {
    e.preventDefault();
    if (!overrideToken.trim() || !overrideReason.trim()) return;
    setOverriding(true);
    setOverrideResult(null);
    try {
      await api.validateEntitlement(overrideToken.trim(), { markUsed: true });
      setOverrideResult({ ok: true, message: "Override applied — ticket marked admitted." });
    } catch (err) {
      setOverrideResult({ ok: false, message: err.message });
    } finally {
      setOverriding(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <LifeBuoy size={22} strokeWidth={2} />
          <div>
            <h1>Ticketing support</h1>
            <p className="page-header__sub">Fan lookup, QR verification &amp; manual gate override</p>
          </div>
        </div>
      </div>

      <div className="page-grid page-grid--2col">
        {/* Lookup panel */}
        <div className="card">
          <div className="card__header">
            <Search size={16} strokeWidth={2} />
            <h2>Fan / ticket lookup</h2>
          </div>
          <p className="text-muted text-sm mb-3">
            Enter a 32- or 64-char QR token, or a fan email address.
          </p>
          <form onSubmit={handleSearch} className="inline-form">
            <input
              type="text"
              className="input"
              placeholder="QR token or fan@email.com"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn--primary" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          <ResultPanel result={result} />
        </div>

        {/* Manual override panel */}
        <div className="card">
          <div className="card__header">
            <ShieldAlert size={16} strokeWidth={2} />
            <h2>Manual override</h2>
          </div>
          <p className="text-muted text-sm mb-3">
            Force-admit a fan. Requires a written reason for the audit trail.
          </p>
          <form onSubmit={handleOverride} className="vertical-form">
            <div className="form-group">
              <label>QR token</label>
              <input
                type="text"
                className="input"
                placeholder="Full QR token string"
                value={overrideToken}
                onChange={(e) => setOverrideToken(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Reason *</label>
              <textarea
                className="input input--textarea"
                rows={3}
                placeholder="e.g. Scanner failure at Gate B, fan confirmed via phone booking ref 12345"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn--danger"
              disabled={overriding || !overrideToken.trim() || !overrideReason.trim()}
            >
              {overriding ? "Applying…" : "Apply override"}
            </button>
          </form>

          {overrideResult && (
            <div className={`alert ${overrideResult.ok ? "alert--success" : "alert--error"} mt-3`}>
              {overrideResult.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <span>{overrideResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
