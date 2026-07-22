import { QRCodeSVG } from "qrcode.react";

/**
 * Renders a grid of QR codes, one per unit token.
 * Used in POS receipts for product redemption.
 *
 * @param {{ tokens: Array<{ qrToken: string, unitIndex: number, status: string }> }} props
 */
export default function QrCodeGrid({ tokens = [] }) {
  if (!tokens.length) return null;
  return (
    <div className="qr-grid">
      {tokens.map((t) => (
        <div
          key={t.qrToken}
          className={`qr-grid__item${t.status === "redeemed" ? " qr-grid__item--used" : ""}`}
          title={t.status === "redeemed" ? "Already redeemed" : `Unit ${t.unitIndex + 1}`}
        >
          <QRCodeSVG
            value={t.qrToken}
            size={96}
            level="M"
            fgColor={t.status === "redeemed" ? "#aaa" : "#111"}
          />
          <div className="qr-grid__label">
            {t.status === "redeemed" ? (
              <span className="qr-grid__used-badge">Used</span>
            ) : (
              <span className="qr-grid__unit">#{t.unitIndex + 1}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
