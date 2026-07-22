import { useState, useEffect, useCallback } from "react";
import "./fan-content-pages.css";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? "coxa-club-001";
const TOKEN_KEY = "coxa_fan_token";

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return { "Content-Type": "application/json", "x-tenant-id": TENANT_ID, ...(t && { Authorization: `Bearer ${t}` }) };
}

function useCountdown(endAt) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const diff = Math.max(0, new Date(endAt).getTime() - Date.now());
      if (diff === 0) { setLabel("Closed"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(`Closes in ${h}h ${m}min`);
    }
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [endAt]);

  return label;
}

function initials(name) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const MOCK_ACTIVE_POLLS = [
  {
    id: "poll1", type: "MOTM",
    title: "Best on the pitch — Coritiba 2x1 Atletico",
    endsAt: new Date(Date.now() + 2 * 3600000 + 15 * 60000).toISOString(),
    totalVotes: 1843,
    options: [
      { id: "o1", label: "Rodrigo Garro", votes: 780 },
      { id: "o2", label: "Alef Manga",    votes: 540 },
      { id: "o3", label: "Guilherme Biro",votes: 310 },
      { id: "o4", label: "Bruno Gomes",   votes: 213 },
    ],
  },
  {
    id: "poll2", type: "MOTM",
    title: "Player of the match — Gremio 0x2 Coritiba",
    endsAt: new Date(Date.now() + 5 * 3600000).toISOString(),
    totalVotes: 962,
    options: [
      { id: "o5", label: "Igor Paixao",   votes: 431 },
      { id: "o6", label: "Natanael",      votes: 278 },
      { id: "o7", label: "Chancellor",    votes: 253 },
    ],
  },
  {
    id: "poll3", type: "Poll",
    title: "What will the score be against Chapecoense?",
    endsAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    totalVotes: 3214,
    options: [
      { id: "o8",  label: "Coritiba wins 2-0",    votes: 1102 },
      { id: "o9",  label: "Coritiba wins 1-0",    votes: 890  },
      { id: "o10", label: "Draw",                 votes: 742  },
      { id: "o11", label: "Chapecoense wins",     votes: 480  },
    ],
  },
];

const MOCK_PAST_POLLS = [
  {
    id: "past1", type: "MOTM", title: "Best on the pitch — Coritiba 1x0 Londrina",
    endsAt: new Date(Date.now() - 86400000).toISOString(), totalVotes: 2100,
    options: [
      { id: "pp1", label: "Gabriel Vasconcelos", votes: 1050 },
      { id: "pp2", label: "Natanael",            votes: 630  },
      { id: "pp3", label: "Alex Muralha",        votes: 420  },
    ],
  },
];

const TYPE_CLASS = { MOTM: "motm", Poll: "enquete", "Who's Out?": "quem" };
const TABS = ["Active", "Closed"];

function Toast({ msg }) {
  return <div className="fc-toast">{msg}</div>;
}

function PollCard({ poll, onVote, toast }) {
  const [selected, setSelected] = useState(null);
  const [voted, setVoted] = useState(false);
  const [totals, setTotals] = useState(poll.options);
  const countdown = useCountdown(poll.endsAt);
  const totalVotes = totals.reduce((s, o) => s + o.votes, 0);

  async function handleVote() {
    if (!selected || voted) return;
    const newTotals = totals.map((o) => o.id === selected ? { ...o, votes: o.votes + 1 } : o);
    setTotals(newTotals);
    setVoted(true);
    await fetch(`${API_URL}/api/v1/cdp/events`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ eventName: "poll_voted", properties: { pollId: poll.id, optionId: selected }, source: "fan_app" }),
    }).catch(() => {});
    onVote();
  }

  return (
    <article className="poll-card">
      <div className="poll-card__header">
        <h2 className="poll-card__title">{poll.title}</h2>
        <div className="poll-card__meta">
          <span className={`fc-cat-badge fc-cat-badge--${TYPE_CLASS[poll.type] ?? "enquete"}`}>{poll.type}</span>
          <span className="poll-card__countdown">{countdown}</span>
        </div>
      </div>

      <div className="poll-options">
        {totals.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const isSelected = selected === opt.id;
          const isVoted = voted;
          return (
            <button
              key={opt.id}
              className={`poll-option${isVoted ? " poll-option--voted" : ""}${isSelected && !isVoted ? " poll-option--selected" : ""}`}
              onClick={() => !voted && setSelected(opt.id)}
              disabled={voted}
              aria-pressed={isSelected}
            >
              {isVoted && <span className="poll-option__bar" style={{ width: `${pct}%` }} />}
              <span className="poll-option__content">
                {poll.type === "MOTM" && (
                  <span className="poll-option__avatar-sm">{initials(opt.label)}</span>
                )}
                <span className="poll-option__label">{opt.label}</span>
                {isVoted && <span className="poll-option__pct">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>

      {!voted && (
        <button className="poll-vote-btn" disabled={!selected} onClick={handleVote}>Vote</button>
      )}
      {voted && (
        <button className="poll-vote-btn poll-vote-btn--done" disabled>Vote registered ✓</button>
      )}
      <p className="poll-card__total">{(totalVotes).toLocaleString("en-US")} votes</p>
    </article>
  );
}

function PastPollCard({ poll }) {
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
  const winner = [...poll.options].sort((a, b) => b.votes - a.votes)[0];

  return (
    <article className="poll-card" style={{ opacity: 0.85 }}>
      <div className="poll-card__header">
        <h2 className="poll-card__title">{poll.title}</h2>
        <div className="poll-card__meta">
          <span className={`fc-cat-badge fc-cat-badge--${TYPE_CLASS[poll.type] ?? "enquete"}`}>{poll.type}</span>
          <span className="poll-card__countdown">Closed</span>
        </div>
      </div>
      <div className="poll-options">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const isWinner = opt.id === winner?.id;
          return (
            <div key={opt.id} className={`poll-option poll-option--voted${isWinner ? "" : ""}`} style={{ cursor: "default" }}>
              <span className="poll-option__bar" style={{ width: `${pct}%`, background: isWinner ? "rgba(12,107,58,0.18)" : "rgba(0,0,0,0.06)" }} />
              <span className="poll-option__content">
                {poll.type === "MOTM" && <span className="poll-option__avatar-sm">{initials(opt.label)}</span>}
                <span className="poll-option__label">{opt.label}{isWinner ? " 🏆" : ""}</span>
                <span className="poll-option__pct">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="poll-card__total">{totalVotes.toLocaleString("en-US")} votes</p>
    </article>
  );
}

export default function PollsPage() {
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState(null);

  document.title = "Polls — Coxa";

  const showToast = useCallback(() => {
    setToast("Vote registered! Thank you for participating 🗳️");
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <div className="poll-page">
      <header className="fc-header">
        <h1>Polls</h1>
      </header>

      <div className="fc-seg poll-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`fc-seg__btn${tab === i ? " fc-seg__btn--active" : ""}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && (
        MOCK_ACTIVE_POLLS.length === 0 ? (
          <div className="fc-empty"><div className="fc-empty__icon">🗳️</div><p>No active polls at the moment.</p></div>
        ) : (
          MOCK_ACTIVE_POLLS.map((p) => <PollCard key={p.id} poll={p} onVote={showToast} />)
        )
      )}

      {tab === 1 && (
        MOCK_PAST_POLLS.length === 0 ? (
          <div className="fc-empty"><div className="fc-empty__icon">📊</div><p>No closed polls yet.</p></div>
        ) : (
          MOCK_PAST_POLLS.map((p) => <PastPollCard key={p.id} poll={p} />)
        )
      )}

      {toast && <Toast msg={toast} />}
    </div>
  );
}
