import { useState, useEffect } from "react";
import "./fan-engagement-pages.css";

const ACTIVE_MATCH = {
  id: "match-2026-07-23",
  title: "Coritiba FC × Athletico PR",
  venue: "Estádio Couto Pereira, Curitiba",
  startsAt: new Date(Date.now() + 1 * 3600 * 1000).toISOString(), // 1h from now = active window
};

const UPCOMING_MATCH = {
  title: "Coritiba FC × Fluminense",
  date: "Domingo, 26 Jul • 16h00",
};

const HISTORY = [
  { id: "h1", match: "Coritiba FC × Flamengo",      date: "15 Jul 2026",  pts: 100 },
  { id: "h2", match: "Coritiba FC × São Paulo FC",   date: "5 Jul 2026",   pts: 100 },
  { id: "h3", match: "Coritiba FC × Palmeiras",      date: "22 Jun 2026",  pts: 150 },
  { id: "h4", match: "Coritiba FC × Internacional",  date: "8 Jun 2026",   pts: 100 },
];

const DOT_COLORS = ["#0C6B3A", "#F2C438", "#ffffff", "#22c55e", "#fbbf24", "#86efac"];

function ConfettiDots() {
  const dots = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: DOT_COLORS[i % DOT_COLORS.length],
    dur: `${0.8 + Math.random() * 1.2}s`,
    delay: `${Math.random() * 0.4}s`,
    size: `${6 + Math.random() * 6}px`,
  }));

  return (
    <div className="chkin-confetti-dots" aria-hidden>
      {dots.map((d) => (
        <span
          key={d.id}
          className="chkin-dot"
          style={{
            left: d.left,
            top: 0,
            background: d.color,
            width: d.size,
            height: d.size,
            "--dur": d.dur,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

function isMatchActive(startsAt) {
  const ms = new Date(startsAt).getTime() - Date.now();
  const hoursAway = ms / 3600000;
  return hoursAway > -3 && hoursAway < 3;
}

export default function MatchCheckinPage() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  const active = isMatchActive(ACTIVE_MATCH.startsAt);

  useEffect(() => {
    const stored = localStorage.getItem(`chkin_${ACTIVE_MATCH.id}`);
    if (stored === "1") setAlreadyCheckedIn(true);
  }, []);

  async function handleConfirm() {
    setLoading(true);
    try {
      const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      const token = localStorage.getItem("coxa_fan_token");
      await fetch(`${API_URL}/api/v1/cdp/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": import.meta.env.VITE_TENANT_ID ?? "coxa-club-001",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          eventName: "match_attendance_confirmed",
          properties: {
            matchId: ACTIVE_MATCH.id,
            venue: ACTIVE_MATCH.venue,
            method: "manual_checkin",
          },
          source: "fan_app",
        }),
      }).catch(() => {});

      localStorage.setItem(`chkin_${ACTIVE_MATCH.id}`, "1");
      setShowConfirm(false);
      setCheckedIn(true);
      setAlreadyCheckedIn(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="eng-page">
      <header className="eng-header">
        <h1>🏟️ Stadium Check-in</h1>
      </header>

      {showConfetti && <ConfettiDots />}

      {checkedIn ? (
        <div className="chkin-success">
          <div className="chkin-success__emoji">✅</div>
          <div className="chkin-success__title">Check-in done!</div>
          <div className="chkin-success__sub">+100 points added to your account 🎉</div>
        </div>
      ) : active ? (
        <>
          {alreadyCheckedIn ? (
            <div className="chkin-success">
              <div className="chkin-success__emoji">✅</div>
              <div className="chkin-success__title">You already checked in for this match!</div>
              <div className="chkin-success__sub">Enjoy the game. Let's go Coxa! 💚</div>
            </div>
          ) : (
            <div className="chkin-match-card">
              <p className="chkin-match-card__label">🟢 Live match — check-in available</p>
              <h2 className="chkin-match-card__title">{ACTIVE_MATCH.title}</h2>
              <p className="chkin-match-card__venue">📍 {ACTIVE_MATCH.venue}</p>
              <button className="chkin-btn" onClick={() => setShowConfirm(true)}>
                Check in
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="chkin-no-match">
          <div className="chkin-no-match__icon">📅</div>
          <div className="chkin-no-match__title">No match today</div>
          <p className="chkin-no-match__sub">
            Come back on match day to check in and earn points!
          </p>
          <div className="chkin-upcoming">
            <div className="chkin-upcoming__label">Next match</div>
            <div className="chkin-upcoming__title">{UPCOMING_MATCH.title}</div>
            <div style={{ fontSize: "0.8rem", color: "#555", marginTop: "0.1rem" }}>
              {UPCOMING_MATCH.date}
            </div>
          </div>
        </div>
      )}

      <p className="chkin-section-title">Check-in History</p>
      <div className="chkin-history">
        {HISTORY.map((h) => (
          <div key={h.id} className="chkin-history-item">
            <span className="chkin-history-item__icon">🏟️</span>
            <div className="chkin-history-item__info">
              <div className="chkin-history-item__match">{h.match}</div>
              <div className="chkin-history-item__date">{h.date}</div>
            </div>
            <span className="chkin-history-item__pts">+{h.pts} pts</span>
          </div>
        ))}
      </div>

      {showConfirm && (
        <div className="eng-sheet-overlay" onClick={() => setShowConfirm(false)}>
          <div className="eng-sheet chkin-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="eng-sheet__handle" />
            <div className="chkin-confirm__icon">🏟️</div>
            <div className="chkin-confirm__title">Confirm attendance</div>
            <p className="chkin-confirm__sub">
              Are you at <strong>{ACTIVE_MATCH.venue}</strong>?<br />
              Earn <strong>+100 points</strong> by confirming.
            </p>
            <button className="chkin-confirm-btn" onClick={handleConfirm} disabled={loading}>
              {loading ? "Confirming…" : "Yes, I'm at the stadium!"}
            </button>
            <button className="chkin-cancel-btn" onClick={() => setShowConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
