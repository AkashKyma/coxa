import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  ChevronRight,
  ShoppingBag,
  Star,
  Ticket,
  Wallet,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useFanData } from "../context/FanDataContext.jsx";
import { ticketsApi, membershipApi, formatBrl } from "../lib/api.js";

function formatMatchDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function HomePage() {
  const { fanProfile } = useAuth();
  const { firstName } = useOutletContext() ?? {};
  const { loyalty, ticketCount } = useFanData();
  const [nextEvent, setNextEvent] = useState(null);
  const [offer, setOffer] = useState(null);
  const [fanScore, setFanScore] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      ticketsApi.shopEvents(),
      membershipApi.myScore().catch(() => null),
    ])
      .then(async ([eventsRes, scoreRes]) => {
        const upcoming = eventsRes.data?.[0]?.event;
        setNextEvent(upcoming ?? null);
        setFanScore(scoreRes?.data ?? null);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Fetch NBO once fan profile is available
  useEffect(() => {
    const fanId = loyalty?.fan?.id ?? fanProfile?.id;
    if (!fanId) return;
    membershipApi.nextBestOffer?.(fanId)?.then?.((nbo) => setOffer(nbo?.data)).catch(() => {});
  }, [loyalty?.fan?.id, fanProfile?.id]);

  const balance = loyalty?.balance ?? 0;
  const fanName =
    firstName ??
    fanProfile?.fullName?.split(" ")[0] ??
    loyalty?.fan?.fullName?.split(" ")[0] ??
    "Fan";

  const matchDate = formatMatchDate(nextEvent?.startsAt);

  const quickLinks = [
    {
      to: "/tickets",
      icon: Ticket,
      label: "My tickets",
      detail: ticketCount ? `${ticketCount} active` : "Get matchday access",
      tint: "green",
    },
    {
      to: "/shop",
      icon: ShoppingBag,
      label: "Club shop",
      detail: "Jerseys & merch",
      tint: "gold",
    },
    {
      to: "/rewards",
      icon: Star,
      label: "Rewards",
      detail: `${balance.toLocaleString()} points`,
      tint: "orange",
    },
    {
      to: "/membership",
      icon: UserCheck,
      label: "Sócio Coxa",
      detail: fanScore ? `${fanScore.tier?.charAt(0).toUpperCase() + fanScore.tier?.slice(1)} · ${fanScore.totalScore?.toLocaleString()} pts` : "Join membership",
      tint: "ink",
    },
    {
      to: "/wallet",
      icon: Wallet,
      label: "Wallet",
      detail: formatBrl(0),
      tint: "ink",
    },
  ];

  const engagementLinks = [
    { to: "/matches",     emoji: "📅", label: "Matches" },
    { to: "/community",   emoji: "💬", label: "Community" },
    { to: "/predictions", emoji: "🎯", label: "Predictions" },
    { to: "/checkin",     emoji: "🏟️", label: "Check-in" },
    { to: "/leaderboard", emoji: "🏆", label: "Rankings" },
  ];

  return (
    <div className="fan-home">
      <header className="fan-home__hero">
        <p className="fan-home__eyebrow">Matchday hub</p>
        <h1 className="fan-home__title">Hello, {fanName}</h1>
      </header>

      {error && <div className="alert error">{error}</div>}

      {nextEvent ? (
        <Link to="/tickets" className="fan-home__match">
          <div className="fan-home__match-badge">Next match</div>
          <h2 className="fan-home__match-title">{nextEvent.title}</h2>
          {matchDate && <p className="fan-home__match-date">{matchDate}</p>}
          <span className="fan-home__match-cta">
            {ticketCount > 0 ? `${ticketCount} ticket${ticketCount === 1 ? "" : "s"} ready` : "Get tickets"}
            <ChevronRight size={18} aria-hidden />
          </span>
        </Link>
      ) : (
        <Link to="/tickets" className="fan-home__match fan-home__match--empty">
          <div className="fan-home__match-badge">Upcoming</div>
          <h2 className="fan-home__match-title">No match scheduled</h2>
          <p className="fan-home__match-date">Browse events and buy tickets</p>
          <span className="fan-home__match-cta">
            View tickets
            <ChevronRight size={18} aria-hidden />
          </span>
        </Link>
      )}

      <div className="fan-home__stats">
        <Link to="/rewards" className="fan-home__stat fan-home__stat--points">
          <span className="fan-home__stat-label">Points</span>
          <span className="fan-home__stat-value">{balance.toLocaleString()}</span>
        </Link>
        <Link to="/tickets" className="fan-home__stat fan-home__stat--tickets">
          <span className="fan-home__stat-label">Tickets</span>
          <span className="fan-home__stat-value">{ticketCount}</span>
        </Link>
        {fanScore && (
          <Link to="/membership" className="fan-home__stat fan-home__stat--score">
            <span className="fan-home__stat-label">Fan score</span>
            <span className="fan-home__stat-value">{fanScore.totalScore?.toLocaleString()}</span>
          </Link>
        )}
      </div>

      {offer?.offer && (
        <Link to="/shop" className="fan-home__offer">
          <span className="fan-home__offer-tag">For you</span>
          <strong>{offer.offer.title}</strong>
          <p>{offer.offer.description}</p>
          <span className="fan-home__offer-link">
            Shop now <ChevronRight size={16} aria-hidden />
          </span>
        </Link>
      )}

      <section className="fan-ios-group">
        <h2 className="fan-ios-group__label">Quick access</h2>
        <ul className="fan-ios-list">
          {quickLinks.map(({ to, icon: Icon, label, detail, tint }) => (
            <li key={to}>
              <Link to={to} className="fan-ios-row">
                <span className={`fan-ios-row__icon fan-ios-row__icon--${tint}`}>
                  <Icon size={20} strokeWidth={2} aria-hidden />
                </span>
                <span className="fan-ios-row__body">
                  <span className="fan-ios-row__label">{label}</span>
                  <span className="fan-ios-row__detail">{detail}</span>
                </span>
                <ChevronRight className="fan-ios-row__chevron" size={18} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="fan-ios-group">
        <h2 className="fan-ios-group__label">Explore</h2>
        <div style={{ display: "flex", gap: "0.625rem", padding: "0 0 0.5rem", overflowX: "auto", scrollbarWidth: "none" }}>
          {engagementLinks.map(({ to, emoji, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.375rem",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "0.875rem",
                padding: "0.875rem 1rem",
                minWidth: "4.5rem",
                textDecoration: "none",
                color: "#111",
                flexShrink: 0,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{emoji}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#333", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
