import { useEffect } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";

export default function TicketQrModal({ ticket, onClose }) {
  useEffect(() => {
    if (!ticket) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ticket, onClose]);

  if (!ticket) return null;

  function copyToken() {
    if (ticket.qrToken) {
      navigator.clipboard?.writeText(ticket.qrToken);
    }
  }

  const ev = ticket.matchEventId;

  return createPortal(
    <div className="ticket-qr-backdrop" onClick={onClose} role="presentation">
      <div
        className="ticket-qr-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ticket QR pass"
      >
        <div className="ticket-qr-modal__head">
          <div>
            <p className="ticket-qr-modal__eyebrow">Gate pass</p>
            <h3>{ev?.title ?? ticket.ticketNumber}</h3>
            <p>
              {ticket.ticketProductId?.name ?? "Match ticket"} · Section{" "}
              {ticket.sectionCode ?? ticket.ticketProductId?.sectionCode ?? "—"}
            </p>
          </div>
          <button type="button" className="ticket-qr-modal__close" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="ticket-qr-modal__body">
          {ticket.status === "issued" && ticket.qrToken ? (
            <>
              <div className="ticket-qr-modal__code">
                <QRCodeSVG
                  value={ticket.qrToken}
                  size={240}
                  level="M"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#1E212B"
                />
              </div>
              <p className="ticket-qr-modal__hint">Show this code at the gate scanner</p>
              <p className="ticket-qr-modal__meta">
                #{ticket.ticketNumber} · {ticket.status}
              </p>
              <code className="ticket-qr-modal__token">{ticket.qrToken}</code>
              <div className="ticket-qr-modal__actions">
                <button type="button" className="btn btn--secondary" onClick={copyToken}>
                  Copy token
                </button>
                <button type="button" className="btn btn--primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <div className="ticket-qr-modal__unavailable">
              <p>
                QR not available — ticket status: <strong>{ticket.status}</strong>
              </p>
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
