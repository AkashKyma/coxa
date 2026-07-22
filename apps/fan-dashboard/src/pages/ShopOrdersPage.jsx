import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { shopApi, formatBrl } from "../lib/api.js";
import { ChevronDown, ChevronUp, QrCode, ShoppingBag } from "lucide-react";

function OrderQrExpander({ order }) {
  const [open, setOpen] = useState(false);
  const [qrLines, setQrLines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = useCallback(async () => {
    if (qrLines !== null) { setOpen((o) => !o); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await shopApi.saleQrCodes(order.id ?? order._id);
      setQrLines(res.data?.lines ?? []);
      setOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [order, qrLines]);

  return (
    <div className="order-qr-expander">
      <button type="button" className="order-qr-toggle" onClick={toggle} disabled={loading}>
        <QrCode size={13} strokeWidth={2} />
        {loading ? "Loading…" : open ? "Hide QR codes" : "Show QR codes"}
        {!loading && (open ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </button>

      {error && <p className="text-error text-xs" style={{ marginTop: "0.35rem" }}>{error}</p>}

      {open && qrLines && (
        <div className="order-qr-panel">
          {qrLines.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "#666", padding: "0.5rem 0" }}>
              QR codes not yet generated for this order.
            </p>
          ) : (
            qrLines.map((line) => (
              <div key={line.saleLineIndex} className="order-qr-line">
                <div className="order-qr-line__name">
                  {line.productName}
                  <span className="order-qr-line__qty">×{line.tokens.length}</span>
                </div>
                <div className="order-qr-line__grid">
                  {line.tokens.map((t) => (
                    <div
                      key={t.qrToken}
                      className={`order-qr-token${t.status === "redeemed" ? " order-qr-token--used" : ""}`}
                      title={t.status === "redeemed" ? "Already redeemed" : "Show at the stand to collect"}
                    >
                      <QRCodeSVG
                        value={t.qrToken}
                        size={82}
                        level="M"
                        fgColor={t.status === "redeemed" ? "#bbb" : "#1e212b"}
                      />
                      <span className="order-qr-token__label">
                        {t.status === "redeemed" ? "Used ✓" : `Unit ${t.unitIndex + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ShopOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [fan, setFan] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shopApi
      .myOrders()
      .then((res) => {
        setOrders(res.data ?? []);
        setFan(res.fan);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1>My orders</h1>
        <p>{fan ? `${fan.name} · ${fan.email}` : "Your purchase history"}</p>
        <div className="page-header__actions">
          <Link to="/shop" className="link-muted">← Back to shop</Link>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <p className="link-muted" style={{ textAlign: "center", padding: "2rem" }}>Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="empty">
          <ShoppingBag size={32} strokeWidth={1.5} style={{ marginBottom: "0.75rem", opacity: 0.4 }} />
          <p>No orders yet.</p>
          <Link to="/shop" className="btn btn--primary btn--sm" style={{ marginTop: "1rem" }}>
            Go to shop
          </Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id ?? order._id} className="order-card">
              <div className="order-card__header">
                <div className="order-card__meta">
                  <code className="order-card__number">{order.saleNumber}</code>
                  <span className="order-card__date">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <strong className="order-card__total">{formatBrl(order.totalCents)}</strong>
              </div>

              <div className="order-card__lines">
                {order.lines?.map((l, i) => (
                  <div key={i} className="order-card__line">
                    <span className="order-card__line-name">{l.productName}</span>
                    <span className="order-card__line-qty">×{l.qty}</span>
                    <span className="order-card__line-price">
                      {formatBrl(l.lineTotalCents ?? l.unitPriceCents * l.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <OrderQrExpander order={order} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
