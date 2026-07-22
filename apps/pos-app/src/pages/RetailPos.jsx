import { useEffect, useMemo, useState } from "react";
import { fetchCatalog, listLocations, createSale, getSaleQrCodes, formatBrl } from "../lib/api.js";
import QrCodeGrid from "../components/QrCodeGrid.jsx";

export default function RetailPos() {
  const [catalog, setCatalog] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [cart, setCart] = useState([]);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);  // { sale, qrLines }
  const [submitting, setSubmitting] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [fanEmail, setFanEmail] = useState("");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  useEffect(() => {
    listLocations()
      .then((locs) => {
        setLocations(locs.data);
        const store = locs.data.find((l) => l.code === "stadium_store") || locs.data[0];
        if (store) setLocationId(store.id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingLocations(false));
  }, []);

  useEffect(() => {
    if (!locationId) return;

    setLoadingCatalog(true);
    setError(null);
    fetchCatalog(locationId)
      .then((cat) => setCatalog(cat.data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingCatalog(false));

    setCart([]);
    setReceipt(null);
  }, [locationId]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (item) =>
        item.product?.name?.toLowerCase().includes(q) ||
        item.sku?.skuCode?.toLowerCase().includes(q),
    );
  }, [catalog, search]);

  function addToCart(item) {
    const max = item.qtyAvailable ?? 0;
    if (max < 1) return;

    setSuccess(null);
    setCart((prev) => {
      const existing = prev.find((c) => c.sku.id === item.sku.id);
      if (existing) {
        if (existing.qty >= max) return prev;
        return prev.map((c) =>
          c.sku.id === item.sku.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function changeQty(skuId, delta) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.sku.id !== skuId) return c;
          const max = c.qtyAvailable ?? c.qty;
          const next = Math.min(max, c.qty + delta);
          return { ...c, qty: next };
        })
        .filter((c) => c.qty > 0),
    );
  }

  function removeLine(skuId) {
    setCart((prev) => prev.filter((c) => c.sku.id !== skuId));
  }

  const cartTotal = cart.reduce((sum, line) => sum + line.sku.priceCents * line.qty, 0);
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const loading = loadingLocations || loadingCatalog;
  const selectedLocation = locations.find((l) => l.id === locationId);

  async function completeSale() {
    if (!locationId || cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    setReceipt(null);
    try {
      const body = {
        locationId,
        paymentMethod,
        lines: cart.map((line) => ({ skuId: line.sku.id, qty: line.qty })),
      };
      if (fanEmail.trim()) body.fanEmail = fanEmail.trim();

      const res = await createSale(body);
      const sale = res.data;

      let qrLines = [];
      try {
        const qrRes = await getSaleQrCodes(sale.id ?? sale._id);
        qrLines = qrRes.data?.lines ?? [];
      } catch {
        // non-fatal
      }

      setReceipt({ sale, qrLines });
      setCart([]);
      const cat = await fetchCatalog(locationId);
      setCatalog(cat.data ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="pos-alert-stack">
          <div className="alert error">{error}</div>
        </div>
      )}

      {receipt && (
        <div className="pos-receipt pos-receipt--modal">
          <div className="pos-receipt__inner">
            <div className="pos-receipt__header">
              <h3>Receipt — {receipt.sale.saleNumber}</h3>
              <span className="pos-receipt__total">{formatBrl(receipt.sale.totalCents)}</span>
            </div>

            {receipt.qrLines.length > 0 ? (
              <div className="pos-receipt__qr-section">
                <p className="pos-receipt__qr-hint">
                  QR codes below — one per unit. Scan at the stand to redeem.
                </p>
                {receipt.qrLines.map((line) => (
                  <div key={line.saleLineIndex} className="pos-receipt__line">
                    <div className="pos-receipt__line-name">
                      {line.productName} <span className="badge badge--gray">×{line.tokens.length}</span>
                    </div>
                    <QrCodeGrid tokens={line.tokens} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">
                {fanEmail.trim()
                  ? `Sale recorded — loyalty points awarded · `
                  : "Sale recorded · "}
                QR codes generating…
              </p>
            )}

            <div className="pos-receipt__actions">
              <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
                Print
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setReceipt(null)}>
                New sale
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pos-stat-bar">
        <div className="pos-stat">
          <span className="pos-stat__value">{filteredCatalog.length}</span>
          <span className="pos-stat__label">In stock here</span>
        </div>
        <div className="pos-stat">
          <span className="pos-stat__value">{cartCount}</span>
          <span className="pos-stat__label">Items in cart</span>
        </div>
        <div className="pos-stat">
          <span className="pos-stat__value">{formatBrl(cartTotal)}</span>
          <span className="pos-stat__label">Cart total</span>
        </div>
      </div>

      <div className="pos-toolbar">
        <label>
          Location
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={loadingLocations}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label>
          Fan email
          <input
            type="email"
            value={fanEmail}
            onChange={(e) => setFanEmail(e.target.value)}
            placeholder="Optional — for loyalty"
          />
        </label>
        <label className="pos-search">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product name or SKU…"
          />
        </label>
      </div>

      {selectedLocation && (
        <p className="link-muted" style={{ marginBottom: "1rem" }}>
          Showing stock at <strong>{selectedLocation.name}</strong>
          {loadingCatalog ? " · updating…" : ""}
        </p>
      )}

      <div className="pos-layout">
        <section>
          {loading ? (
            <p className="loading-text">Loading catalog…</p>
          ) : filteredCatalog.length === 0 ? (
            <div className="empty">
              {search
                ? "No products match your search at this location."
                : "No stock at this location — receive or transfer inventory first."}
            </div>
          ) : (
            <div className="pos-product-grid">
              {filteredCatalog.map((item) => (
                <article
                  key={item.sku.id}
                  className="pos-product"
                  onClick={() => addToCart(item)}
                  onKeyDown={(e) => e.key === "Enter" && addToCart(item)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="pos-product__body">
                    <h3 className="pos-product__name">{item.product?.name}</h3>
                    <span className="pos-product__sku">{item.sku.skuCode}</span>
                    <p className="pos-product__price">{formatBrl(item.sku.priceCents)}</p>
                    <p className="link-muted" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
                      {item.qtyAvailable ?? 0} in stock
                      {item.lotMeta?.nearestSellBy && (
                        <span
                          className={
                            item.lotMeta.expiringSoon
                              ? "pos-lot-badge pos-lot-badge--warn"
                              : "pos-lot-badge"
                          }
                        >
                          {" "}
                          · Sell by{" "}
                          {new Date(item.lotMeta.nearestSellBy).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="pos-product__foot">
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={(item.qtyAvailable ?? 0) < 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item);
                      }}
                    >
                      Add to cart
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="pos-cart pos-cart--sticky">
          <div className="pos-cart__head">
            <h3>Current sale</h3>
            <div className="pos-cart__count">{cartCount} item{cartCount === 1 ? "" : "s"}</div>
          </div>
          <div className="pos-cart__body">
            {cart.length === 0 ? (
              <p className="cart-empty">Tap a product to start a sale.</p>
            ) : (
              cart.map((line) => (
                <div key={line.sku.id} className="pos-cart__line">
                  <div>
                    <div className="pos-cart__line-name">{line.product?.name}</div>
                    <div className="pos-cart__qty-controls">
                      <button type="button" onClick={() => changeQty(line.sku.id, -1)} aria-label="Decrease">−</button>
                      <span>{line.qty}</span>
                      <button type="button" onClick={() => changeQty(line.sku.id, 1)} aria-label="Increase">+</button>
                    </div>
                  </div>
                  <span className="pos-cart__line-price">{formatBrl(line.sku.priceCents * line.qty)}</span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeLine(line.sku.id)}>×</button>
                </div>
              ))
            )}
          </div>
          <div className="pos-cart__foot">
            <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
              Payment
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: "100%", marginTop: "0.35rem", padding: "0.5rem" }}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="pix">PIX</option>
              </select>
            </label>
            <div className="pos-cart__total">
              <span>Total</span>
              <strong>{formatBrl(cartTotal)}</strong>
            </div>
            <div className="pos-cart__actions">
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={cart.length === 0 || submitting}
                onClick={completeSale}
              >
                {submitting ? "Processing…" : "Complete sale"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
