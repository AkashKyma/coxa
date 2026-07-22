import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  return new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d)
    .replace(",", " ·")
    .replace(".", "");
}

const MOCK_UPCOMING = [
  { id: "m1", homeTeam: "Coritiba", awayTeam: "Athletico-PR", competition: "Campeonato Paranaense", startsAt: new Date(Date.now() + 4 * 86400000).toISOString(), venue: "Couto Pereira" },
  { id: "m2", homeTeam: "Grêmio", awayTeam: "Coritiba", competition: "Brasileirão Série B", startsAt: new Date(Date.now() + 9 * 86400000).toISOString(), venue: "Arena do Grêmio" },
  { id: "m3", homeTeam: "Coritiba", awayTeam: "Chapecoense", competition: "Brasileirão Série B", startsAt: new Date(Date.now() + 14 * 86400000).toISOString(), venue: "Couto Pereira" },
];

const MOCK_PAST = [
  { id: "p1", homeTeam: "Coritiba", awayTeam: "Londrina", homeScore: 2, awayScore: 1, competition: "Campeonato Paranaense", startsAt: new Date(Date.now() - 7 * 86400000).toISOString(), watched: true },
  { id: "p2", homeTeam: "Avaí", awayTeam: "Coritiba", homeScore: 0, awayScore: 0, competition: "Brasileirão Série B", startsAt: new Date(Date.now() - 14 * 86400000).toISOString(), watched: false },
  { id: "p3", homeTeam: "Coritiba", awayTeam: "CSA", homeScore: 3, awayScore: 2, competition: "Brasileirão Série B", startsAt: new Date(Date.now() - 21 * 86400000).toISOString(), watched: true },
];

const SEASON_STATS = { wins: 8, draws: 4, losses: 3 };

const TABS = ["Upcoming", "Results", "Season"];

function SkeletonCard() {
  return (
    <div className="match-skel-card">
      <div className="fc-skel" style={{ height: 130 }} />
    </div>
  );
}

function UpcomingCard({ match }) {
  return (
    <article className="match-card">
      <div className="match-card__teams">
        <div className="match-card__team">
          <span className="match-card__shield">🛡️</span>
          <span className="match-card__team-name">{match.homeTeam}</span>
        </div>
        <span className="match-card__vs">VS</span>
        <div className="match-card__team">
          <span className="match-card__shield">🛡️</span>
          <span className="match-card__team-name">{match.awayTeam}</span>
        </div>
      </div>
      <div className="match-card__meta">
        <span className="match-card__comp">{match.competition}</span>
        <span>·</span>
        <span>{formatMatchDate(match.startsAt)}</span>
        {match.venue && <><span>·</span><span>📍 {match.venue}</span></>}
      </div>
      <Link to="/tickets" className="match-card__ticket-btn">🎟️ Buy Ticket</Link>
    </article>
  );
}

function PastCard({ match }) {
  return (
    <article className="match-card">
      <div className="match-card__teams">
        <div className="match-card__team">
          <span className="match-card__shield">🛡️</span>
          <span className="match-card__team-name">{match.homeTeam}</span>
        </div>
        <span className="match-card__score-vs">{match.homeScore ?? "–"} × {match.awayScore ?? "–"}</span>
        <div className="match-card__team">
          <span className="match-card__shield">🛡️</span>
          <span className="match-card__team-name">{match.awayTeam}</span>
        </div>
      </div>
      <div className="match-card__meta">
        <span className="match-card__comp">{match.competition}</span>
        <span>·</span>
        <span>{formatMatchDate(match.startsAt)}</span>
        {match.watched && <span className="match-card__watched">✓ Watched</span>}
      </div>
    </article>
  );
}

export default function MatchesPage() {
  const [tab, setTab] = useState(0);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  document.title = "Matches — Coxa";

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API_URL}/api/v1/ticketing/events?status=upcoming&limit=10`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .catch(() => ({ data: [] })),
      fetch(`${API_URL}/api/v1/ticketing/events?status=past&limit=10`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .catch(() => ({ data: [] })),
    ])
      .then(([upRes, pastRes]) => {
        const up = upRes?.data ?? [];
        const pa = pastRes?.data ?? [];
        setUpcoming(up.length > 0 ? up : MOCK_UPCOMING);
        setPast(pa.length > 0 ? pa : MOCK_PAST);
      })
      .catch(() => {
        setUpcoming(MOCK_UPCOMING);
        setPast(MOCK_PAST);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const stats = SEASON_STATS;

  return (
    <div className="match-page">
      <header className="fc-header">
        <h1>Matches</h1>
      </header>

      <div className="fc-seg match-seg">
        {TABS.map((t, i) => (
          <button key={t} className={`fc-seg__btn${tab === i ? " fc-seg__btn--active" : ""}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {error && (
        <div className="fc-error">
          {error}
          <br /><button className="fc-retry" onClick={load}>Try again</button>
        </div>
      )}

      {tab === 0 && (
        <>
          {loading ? (
            [1,2,3].map((k) => <SkeletonCard key={k} />)
          ) : upcoming.length === 0 ? (
            <div className="fc-empty"><div className="fc-empty__icon">📭</div><p>No matches scheduled yet.</p></div>
          ) : (
            upcoming.map((m) => <UpcomingCard key={m.id} match={m} />)
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {loading ? (
            [1,2,3].map((k) => <SkeletonCard key={k} />)
          ) : past.length === 0 ? (
            <div className="fc-empty"><div className="fc-empty__icon">📭</div><p>No results available yet.</p></div>
          ) : (
            past.map((m) => <PastCard key={m.id} match={m} />)
          )}
        </>
      )}

      {tab === 2 && (
        <>
          <div className="match-stats-row">
            <div className="match-stat-card"><div className="match-stat-card__val" style={{ color: "#0C6B3A" }}>{stats.wins}</div><div className="match-stat-card__lbl">Wins</div></div>
            <div className="match-stat-card"><div className="match-stat-card__val" style={{ color: "#92400e" }}>{stats.draws}</div><div className="match-stat-card__lbl">Draws</div></div>
            <div className="match-stat-card"><div className="match-stat-card__val" style={{ color: "#b91c1c" }}>{stats.losses}</div><div className="match-stat-card__lbl">Losses</div></div>
          </div>
          <div className="fc-empty" style={{ paddingTop: "1rem" }}>
            <div className="fc-empty__icon">🏆</div>
            <p>Full season 2026 statistics.</p>
          </div>
        </>
      )}
    </div>
  );
}
