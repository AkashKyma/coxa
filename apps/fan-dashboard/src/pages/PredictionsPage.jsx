import { useState, useCallback } from "react";
import "./fan-content-pages.css";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? "coxa-club-001";
const TOKEN_KEY = "coxa_fan_token";

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return { "Content-Type": "application/json", "x-tenant-id": TENANT_ID, ...(t && { Authorization: `Bearer ${t}` }) };
}

function formatMatchDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", " ·").replace(".", "");
}

const OPEN_MATCHES = [
  { id: "m1", homeTeam: "Coritiba",  awayTeam: "Athletico-PR",  competition: "Paranaense", startsAt: new Date(Date.now() + 4  * 86400000).toISOString() },
  { id: "m2", homeTeam: "Gremio",    awayTeam: "Coritiba",      competition: "Serie B",    startsAt: new Date(Date.now() + 9  * 86400000).toISOString() },
  { id: "m3", homeTeam: "Coritiba",  awayTeam: "Chapecoense",   competition: "Serie B",    startsAt: new Date(Date.now() + 14 * 86400000).toISOString() },
];

const HISTORY = [
  { id: "h1", homeTeam: "Coritiba", awayTeam: "Londrina",   myHome: 2, myAway: 1, realHome: 2, realAway: 1, result: "correct",  pts: 50 },
  { id: "h2", homeTeam: "Avai",     awayTeam: "Coritiba",   myHome: 1, myAway: 0, realHome: 0, realAway: 0, result: "wrong",    pts: 0  },
  { id: "h3", homeTeam: "Coritiba", awayTeam: "CSA",        myHome: 3, myAway: 1, realHome: 3, realAway: 2, result: "close",    pts: 20 },
];

const RESULT_LABEL = { correct: "Correct", close: "Close", wrong: "Wrong" };
const RESULT_PREFIX = { correct: "✓", close: "~", wrong: "✗" };

const TABS = ["Predict", "My Predictions"];

function Toast({ msg }) {
  return <div className="fc-toast">{msg}</div>;
}

function PredCard({ match, onSubmit }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = home !== "" && away !== "" && !loading && !done;

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/cdp/events`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ eventName: "prediction_submitted", properties: { matchId: match.id, homeScore: Number(home), awayScore: Number(away) }, source: "fan_app" }),
      }).catch(() => {});
      setDone(true);
      onSubmit(match.id, home, away);
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="pred-card">
      <div className="pred-card__fixture">
        <span>🛡️</span>
        <span>{match.homeTeam}</span>
        <span style={{ color: "#888", fontWeight: 400 }}>vs</span>
        <span>{match.awayTeam}</span>
        <span>🛡️</span>
      </div>
      <p className="pred-card__date">{match.competition} · {formatMatchDate(match.startsAt)}</p>
      <div className="pred-score-row">
        <input className="pred-score-input" type="number" min={0} max={9} placeholder="?" value={home} onChange={(e) => setHome(e.target.value)} disabled={done} aria-label={`Goals ${match.homeTeam}`} />
        <span className="pred-score-sep">×</span>
        <input className="pred-score-input" type="number" min={0} max={9} placeholder="?" value={away} onChange={(e) => setAway(e.target.value)} disabled={done} aria-label={`Goals ${match.awayTeam}`} />
      </div>
      <button className={`pred-submit-btn${done ? " pred-submit-btn--done" : ""}`} disabled={!canSubmit} onClick={handleSubmit}>
        {done ? "Prediction submitted ✓" : loading ? "Submitting…" : "Submit Prediction"}
      </button>
    </article>
  );
}

export default function PredictionsPage() {
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState(null);

  document.title = "Predictions — Coxa";

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  function handlePredSubmit(matchId, home, away) {
    showToast(`Palpite registrado! +50 pontos 🏆`);
  }

  return (
    <div className="pred-page">
      <header className="fc-header">
        <h1>🏆 Predictions</h1>
      </header>
      <p className="fc-subtitle">Predict the score and earn points!</p>

      <div className="fc-seg pred-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`fc-seg__btn${tab === i ? " fc-seg__btn--active" : ""}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && (
        OPEN_MATCHES.length === 0 ? (
          <div className="fc-empty"><div className="fc-empty__icon">⏳</div><p>No open matches to predict right now.</p></div>
        ) : (
          OPEN_MATCHES.map((m) => <PredCard key={m.id} match={m} onSubmit={handlePredSubmit} />)
        )
      )}

      {tab === 1 && (
        HISTORY.length === 0 ? (
          <div className="fc-empty"><div className="fc-empty__icon">📋</div><p>You haven't made any predictions yet. Start now!</p></div>
        ) : (
          HISTORY.map((h) => (
            <div key={h.id} className="pred-hist-card">
              <div className="pred-hist-card__fixture">
                <p className="pred-hist-card__teams">{h.homeTeam} vs {h.awayTeam}</p>
                <p className="pred-hist-card__scores">
                  Your prediction: <strong>{h.myHome}×{h.myAway}</strong> · Result: <strong>{h.realHome}×{h.realAway}</strong>
                </p>
              </div>
              <div className="pred-hist-card__right">
                <span className={`pred-result-badge pred-result-badge--${h.result}`}>
                  {RESULT_PREFIX[h.result]} {RESULT_LABEL[h.result]}
                </span>
                <p className="pred-pts">{h.pts} pts</p>
              </div>
            </div>
          ))
        )
      )}

      {toast && <Toast msg={toast} />}
    </div>
  );
}
