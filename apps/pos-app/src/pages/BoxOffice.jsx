import { useEffect, useState } from "react";
import {
  listTicketingEvents,
  getEventDetail,
  issueTickets,
  formatBrl,
} from "../lib/api.js";

function formatEventDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function BoxOffice() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [products, setProducts] = useState([]);
  const [fanEmail, setFanEmail] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listTicketingEvents()
      .then((res) => {
        setEvents(res.data);
        if (res.data[0]) setSelectedEventId(res.data[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    getEventDetail(selectedEventId)
      .then((res) => {
        setSelectedEvent(res.data.event);
        setProducts(res.data.products ?? []);
        setProductId(res.data.products?.[0]?.id ?? "");
      })
      .catch((err) => setError(err.message));
  }, [selectedEventId]);

  async function sellTicket(e) {
    e.preventDefault();
    if (!selectedEventId || !productId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await issueTickets({
        matchEventId: selectedEventId,
        ticketProductId: productId,
        qty: Number(qty),
        fanEmail: fanEmail.trim() || undefined,
        idempotencyKey: `pos-${Date.now()}`,
      });
      const tickets = res.data;
      setSuccess(
        `Issued ${tickets.length} ticket(s): ${tickets.map((t) => t.ticketNumber).join(", ")}`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === productId);
  const lineTotal = selectedProduct ? selectedProduct.priceCents * Number(qty) : 0;

  return (
    <div>
      {(error || success) && (
        <div className="pos-alert-stack">
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}
        </div>
      )}

      {loading ? (
        <p className="loading-text">Loading events…</p>
      ) : events.length === 0 ? (
        <div className="empty">No upcoming events on sale.</div>
      ) : (
        <div className="pos-box-layout">
          <section>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Select event</h2>
            <div className="pos-event-list">
              {events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`pos-event-card${selectedEventId === ev.id ? " selected" : ""}`}
                  onClick={() => setSelectedEventId(ev.id)}
                >
                  <h3 className="pos-event-card__title">{ev.title}</h3>
                  <p className="pos-event-card__meta">
                    {ev.homeTeam} vs {ev.awayTeam} · {formatEventDate(ev.startsAt)}
                  </p>
                </button>
              ))}
            </div>

            {products.length > 0 && (
              <>
                <h2 style={{ margin: "1.5rem 0 1rem", fontSize: "1rem" }}>Ticket type</h2>
                <div className="pos-ticket-options">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`pos-ticket-option${productId === p.id ? " selected" : ""}`}
                      onClick={() => setProductId(p.id)}
                    >
                      <div>
                        <div className="pos-ticket-option__name">{p.name}</div>
                        <div className="pos-ticket-option__meta">
                          {p.sectionCode} · {p.availableCount ?? 0} available
                        </div>
                      </div>
                      <span className="pos-ticket-option__price">{formatBrl(p.priceCents)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <aside className="pos-checkout-panel">
            <h3>Issue tickets</h3>
            <dl className="pos-checkout-summary">
              <dt>Event</dt>
              <dd>{selectedEvent?.title ?? "—"}</dd>
              <dt>Product</dt>
              <dd>{selectedProduct?.name ?? "—"}</dd>
            </dl>

            <form onSubmit={sellTicket} className="form-grid">
              <div className="form-field">
                <label className="field-label">Quantity</label>
                <div className="pos-cart__qty-controls" style={{ width: "fit-content" }}>
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <span>{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(6, q + 1))}>+</button>
                </div>
              </div>
              <div className="form-field form-field--full">
                <label className="field-label">Fan email (optional)</label>
                <input
                  type="email"
                  value={fanEmail}
                  onChange={(e) => setFanEmail(e.target.value)}
                  placeholder="fan@coxa.local"
                />
              </div>
              <div className="pos-checkout-total">
                <span>Total</span>
                <strong>{formatBrl(lineTotal)}</strong>
              </div>
              <button type="submit" className="btn btn--primary btn--block" disabled={submitting || !productId}>
                {submitting ? "Issuing…" : "Issue tickets (cash)"}
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
