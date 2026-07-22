import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ticketsApi, formatBrl } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import TicketQrModal from "../components/TicketQrModal.jsx";

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buying, setBuying] = useState(null);
  const [qrTicket, setQrTicket] = useState(null);

  const { fanProfile } = useAuth();

  function load() {
    setLoading(true);
    Promise.all([ticketsApi.myTickets(), ticketsApi.shopEvents()])
      .then(([ticketRes, shopRes]) => {
        setTickets(ticketRes.data ?? []);
        setEvents(shopRes.data ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function buyTicket(matchEventId, ticketProductId) {
    setBuying(ticketProductId);
    setError(null);
    try {
      await ticketsApi.purchase({
        matchEventId,
        lines: [{ ticketProductId, qty: 1 }],
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBuying(null);
    }
  }

  return (
    <div>
      <header className="page-header">
        <h1>My tickets</h1>
        <p>Match tickets, QR passes and check-in for {fanProfile?.email ?? "your account"}.</p>
      </header>

      {error && (
        <div className="alert error">
          {error}
          {error.includes("sign in") && (
            <p style={{ marginTop: "0.5rem" }}>
              <a href={import.meta.env.VITE_AUTH_URL ?? "http://localhost:5175"}>Sign in again</a>
            </p>
          )}
        </div>
      )}

      <section className="panel">
        <h2 className="panel__title">Your tickets</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="empty">No tickets yet. Buy one below.</p>
        ) : (
          <div className="cards">
            {tickets.map((ticket) => {
              const ev = ticket.matchEventId;
              const hasQr = ticket.status === "issued" && ticket.qrToken;
              return (
                <article key={ticket.id} className="card">
                  <h3>{ev?.title ?? "Match ticket"}</h3>
                  <p className="panel__desc">{formatDate(ev?.startsAt)}</p>
                  <p>
                    <strong>{ticket.ticketProductId?.name ?? "Ticket"}</strong>
                    {" · "}
                    Section {ticket.sectionCode ?? ticket.ticketProductId?.sectionCode ?? "—"}
                  </p>
                  <p className="panel__desc">
                    #{ticket.ticketNumber} · {ticket.status}
                  </p>
                  {hasQr && (
                    <div className="ticket-card__qr">
                      <button
                        type="button"
                        className="ticket-card__qr-preview"
                        onClick={() => setQrTicket(ticket)}
                        aria-label="Open full screen QR pass"
                      >
                        <QRCodeSVG
                          value={ticket.qrToken}
                          size={128}
                          level="M"
                          includeMargin
                          bgColor="#ffffff"
                          fgColor="#1E212B"
                        />
                      </button>
                      <p className="ticket-card__qr-label">Tap QR for full-screen gate pass</p>
                      <button
                        type="button"
                        className="btn btn--primary"
                        style={{ marginTop: "0.75rem", width: "100%" }}
                        onClick={() => setQrTicket(ticket)}
                      >
                        Show QR pass
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel__title">Buy tickets</h2>
        {(events ?? []).length === 0 ? (
          <p className="empty">No events on sale.</p>
        ) : (
          events.map(({ event, products = [] }) => (
            <div key={event.id} style={{ marginBottom: "1.5rem" }}>
              <h3>{event.title}</h3>
              <p className="panel__desc">
                {event.homeTeam} vs {event.awayTeam} · {formatDate(event.startsAt)}
              </p>
              <div className="cards">
                {products.map((p) => (
                  <div key={p.id} className="card">
                    <h3>{p.name}</h3>
                    <p className="value">{formatBrl(p.priceCents)}</p>
                    <p className="panel__desc">{p.availableCount ?? 0} left</p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={buying === p.id || (p.availableCount ?? 0) < 1}
                      onClick={() => buyTicket(event.id, p.id)}
                    >
                      {buying === p.id ? "Buying…" : "Buy ticket"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <TicketQrModal ticket={qrTicket} onClose={() => setQrTicket(null)} />
    </div>
  );
}
