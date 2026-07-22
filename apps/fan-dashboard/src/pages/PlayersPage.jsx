import { useState, useEffect, useMemo } from "react";
import "./fan-content-pages.css";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? "coxa-club-001";
const TOKEN_KEY = "coxa_fan_token";

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return { "Content-Type": "application/json", "x-tenant-id": TENANT_ID, ...(t && { Authorization: `Bearer ${t}` }) };
}

function calcAge(dob) {
  if (!dob) return "–";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "–";
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
}

function initials(name) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const POSITIONS = ["All", "Goalkeepers", "Defenders", "Midfielders", "Forwards"];
const POS_FILTER = { Goalkeepers: "Goleiro", Defenders: "Defensor", Midfielders: "Meio-campista", Forwards: "Atacante" };

const MOCK_PLAYERS = [
  { id: "p1",  name: "Alex Muralha",       number: 1,  position: "Goleiro",      nationality: "🇧🇷", dateOfBirth: "1990-05-15", matches: 32, goals: 0, assists: 0 },
  { id: "p2",  name: "Rafael William",     number: 12, position: "Goleiro",      nationality: "🇧🇷", dateOfBirth: "1998-03-22", matches: 5,  goals: 0, assists: 0 },
  { id: "p3",  name: "Natanael",           number: 2,  position: "Defensor",     nationality: "🇧🇷", dateOfBirth: "1997-11-08", matches: 28, goals: 1, assists: 3 },
  { id: "p4",  name: "Chancellor",         number: 4,  position: "Defensor",     nationality: "🇧🇷", dateOfBirth: "1995-06-30", matches: 30, goals: 2, assists: 1 },
  { id: "p5",  name: "Luciano Castán",     number: 5,  position: "Defensor",     nationality: "🇧🇷", dateOfBirth: "1991-08-21", matches: 25, goals: 1, assists: 0 },
  { id: "p6",  name: "Guilherme Biro",     number: 6,  position: "Defensor",     nationality: "🇧🇷", dateOfBirth: "2000-01-14", matches: 20, goals: 0, assists: 4 },
  { id: "p7",  name: "Bruno Gomes",        number: 8,  position: "Meio-campista",nationality: "🇧🇷", dateOfBirth: "1996-09-12", matches: 31, goals: 3, assists: 5 },
  { id: "p8",  name: "Sebastián Gómez",   number: 7,  position: "Meio-campista",nationality: "🇨🇴", dateOfBirth: "1994-04-17", matches: 27, goals: 5, assists: 8 },
  { id: "p9",  name: "Matheus Bueno",      number: 14, position: "Meio-campista",nationality: "🇧🇷", dateOfBirth: "1999-07-03", matches: 18, goals: 2, assists: 3 },
  { id: "p10", name: "Gabriel Vasconcelos",number: 10, position: "Meio-campista",nationality: "🇧🇷", dateOfBirth: "1998-02-28", matches: 30, goals: 7, assists: 6 },
  { id: "p11", name: "Rodrigo Garro",      number: 11, position: "Atacante",     nationality: "🇦🇷", dateOfBirth: "1998-10-11", matches: 29, goals: 9, assists: 7 },
  { id: "p12", name: "Alef Manga",         number: 9,  position: "Atacante",     nationality: "🇧🇷", dateOfBirth: "1997-05-07", matches: 26, goals: 12, assists: 3 },
  { id: "p13", name: "Léo Gamalho",        number: 19, position: "Atacante",     nationality: "🇧🇷", dateOfBirth: "1987-12-25", matches: 15, goals: 6, assists: 1 },
  { id: "p14", name: "Kaio César",         number: 17, position: "Atacante",     nationality: "🇧🇷", dateOfBirth: "2001-08-19", matches: 22, goals: 4, assists: 2 },
  { id: "p15", name: "Régis",              number: 23, position: "Meio-campista",nationality: "🇧🇷", dateOfBirth: "1993-07-26", matches: 14, goals: 1, assists: 4 },
  { id: "p16", name: "Willian Farias",     number: 16, position: "Defensor",     nationality: "🇧🇷", dateOfBirth: "1992-11-04", matches: 19, goals: 0, assists: 2 },
  { id: "p17", name: "Igor Paixão",        number: 18, position: "Atacante",     nationality: "🇧🇷", dateOfBirth: "2000-06-14", matches: 24, goals: 8, assists: 9 },
  { id: "p18", name: "Matheus Lima",       number: 22, position: "Defensor",     nationality: "🇧🇷", dateOfBirth: "1999-03-09", matches: 10, goals: 0, assists: 1 },
];

function SkeletonGrid() {
  return (
    <div className="plyr-grid">
      {[1,2,3,4,5,6].map((k) => (
        <div key={k} className="fc-skel" style={{ height: 140, borderRadius: 16 }} />
      ))}
    </div>
  );
}

function PlayerCard({ player, onClick }) {
  return (
    <button className="plyr-card" onClick={() => onClick(player)} aria-label={`View profile of ${player.name}`}>
      <span className="plyr-card__num">#{player.number}</span>
      <div className="plyr-avatar">{initials(player.name)}</div>
      <p className="plyr-card__name">{player.name}</p>
      <p className="plyr-card__pos">{player.position}</p>
      <span className="plyr-card__nat">{player.nationality}</span>
    </button>
  );
}

function PlayerModal({ player, onClose }) {
  if (!player) return null;
  return (
    <div className="plyr-modal-overlay" onClick={onClose}>
      <div className="plyr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plyr-modal__close">
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="plyr-modal__avatar">{initials(player.name)}</div>
        <h2 className="plyr-modal__name">{player.name} {player.nationality}</h2>
        <p className="plyr-modal__pos">#{player.number} · {player.position}</p>
        <div className="plyr-modal__stats">
          <div className="plyr-stat"><div className="plyr-stat__val">{player.matches}</div><div className="plyr-stat__lbl">Matches</div></div>
          <div className="plyr-stat"><div className="plyr-stat__val">{player.goals}</div><div className="plyr-stat__lbl">Goals</div></div>
          <div className="plyr-stat"><div className="plyr-stat__val">{player.assists}</div><div className="plyr-stat__lbl">Assists</div></div>
        </div>
        <div className="plyr-modal__info">
          <div className="plyr-info-row"><span className="plyr-info-row__label">Position</span><span className="plyr-info-row__val">{player.position}</span></div>
          <div className="plyr-info-row"><span className="plyr-info-row__label">Age</span><span className="plyr-info-row__val">{calcAge(player.dateOfBirth)} yrs</span></div>
          <div className="plyr-info-row"><span className="plyr-info-row__label">Nationality</span><span className="plyr-info-row__val">{player.nationality}</span></div>
          <div className="plyr-info-row"><span className="plyr-info-row__label">Season</span><span className="plyr-info-row__val">2026</span></div>
        </div>
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const [activePos, setActivePos] = useState("All");
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  document.title = "Squad — Coxa";

  function load() {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/v1/players?fields=id,name,number,position,nationality,dateOfBirth,photo_url`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        const list = data?.data ?? data?.players ?? [];
        setPlayers(list.length > 0 ? list : MOCK_PLAYERS);
      })
      .catch(() => setPlayers(MOCK_PLAYERS))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (activePos === "All") return players;
    const posLabel = POS_FILTER[activePos];
    return players.filter((p) => p.position === posLabel || p.position?.includes(posLabel?.split("-")[0] ?? ""));
  }, [players, activePos]);

  return (
    <div className="plyr-page">
      <header className="fc-header">
        <h1>Squad <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666", marginLeft: "0.25rem" }}>2026</span></h1>
      </header>

      <div className="fc-chips plyr-chips">
        {POSITIONS.map((p) => (
          <button key={p} className={`fc-chip${activePos === p ? " fc-chip--active" : ""}`} onClick={() => setActivePos(p)}>{p}</button>
        ))}
      </div>

      {error && (
        <div className="fc-error">{error}<br /><button className="fc-retry" onClick={load}>Try again</button></div>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <div className="fc-empty"><div className="fc-empty__icon">👕</div><p>No players in this position yet.</p></div>
      ) : (
        <div className="plyr-grid">
          {filtered.map((p) => <PlayerCard key={p.id} player={p} onClick={setSelected} />)}
        </div>
      )}

      {selected && <PlayerModal player={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
