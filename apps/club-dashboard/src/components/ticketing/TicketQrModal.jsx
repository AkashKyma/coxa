import { QRCodeSVG } from "qrcode.react";
import { X, Copy, ScanLine } from "lucide-react";

export default function TicketQrModal({ ticket, onClose, onScanAtGate }) {
  if (!ticket) return null;

  function copyToken() {
    if (ticket.qrToken) {
      navigator.clipboard?.writeText(ticket.qrToken);
    }
  }

  return (
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
            <h3>{ticket.ticketNumber}</h3>
            <p>{ticket.ticketProductId?.name ?? "Match ticket"} · {ticket.sectionCode ?? "—"}</p>
          </div>
          <button type="button" className="form-sidebar__close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="ticket-qr-modal__body">
          {ticket.status === "issued" && ticket.qrToken ? (
            <>
              <div className="ticket-qr-modal__code">
                <QRCodeSVG
                  value={ticket.qrToken}
                  size={200}
                  level="M"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#1E212B"
                />
              </div>
              <p className="ticket-qr-modal__hint">Fan shows this QR at the gate scanner</p>
              <code className="ticket-qr-modal__token">{ticket.qrToken}</code>
              <div className="ticket-qr-modal__actions">
                <button type="button" className="btn btn--secondary btn--sm" onClick={copyToken}>
                  <Copy size={14} style={{ marginRight: "0.35rem", verticalAlign: "-2px" }} />
                  Copy token
                </button>
                {onScanAtGate && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => {
                      onScanAtGate(ticket.qrToken);
                      onClose();
                    }}
                  >
                    <ScanLine size={14} style={{ marginRight: "0.35rem", verticalAlign: "-2px" }} />
                    Send to gate
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="ticket-qr-modal__unavailable">
              <p>QR not available — ticket status: <strong>{ticket.status}</strong></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
