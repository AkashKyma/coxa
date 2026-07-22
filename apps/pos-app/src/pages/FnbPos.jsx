import { useEffect, useMemo, useState } from "react";
import { fetchCatalog, listLocations, createSale, getSaleQrCodes, formatBrl } from "../lib/api.js";
import QrCodeGrid from "../components/QrCodeGrid.jsx";

export default function FnbPos() {
  const [catalog, setCatalog] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [cart, setCart] = useState([]);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);   // { sale, qrLines }
  const [submitting, setSubmitting] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [fanEmail, setFanEmail] = useState("");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  useEffect(() => {
    listLocations()
      .then((res) => {
        const allLocs = res.data ?? [];
        // Prefer fnb_stand locations; fall back to all if none exist
        const fnbLocs = allLocs.filter((l) => l.type === "fnb_stand");
        const shown = fnbLocs.length ? fnbLocs : allLocs;
        setLocations(shown);
        if (shown.length) setLocationId(shown[0].id ?? shown[0]._id);
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
    setReceipt(null);
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
  const selectedLocation = locations.find((l) => (l.id ?? l._id) === locationId);

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
        saleNumberPrefix: "FB",
      };
      if (fanEmail.trim()) body.fanEmail = fanEmail.trim();

      const res = await createSale(body);
      const sale = res.data;

      // Load QR codes for the receipt (best-effort — don't fail if not ready yet)
      let qrLines = [];
      try {
        const qrRes = await getSaleQrCodes(sale.id ?? sale._id);
        qrLines = qrRes.data?.lines ?? [];
      } catch {
        // QR generation is async — they may not be ready immediately
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
              <h3>F&amp;B Receipt — {receipt.sale.saleNumber}</h3>
              <span className="pos-receipt__total">{formatBrl(receipt.sale.totalCents)}</span>
            </div>

            {receipt.qrLines.length > 0 ? (
              <div className="pos-receipt__qr-section">
                <p className="pos-receipt__qr-hint">
                  Scan each QR to hand out items — one QR per unit.
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
              <p className="text-muted text-sm">QR codes are being generated — refresh if needed.</p>
            )}

            <div className="pos-receipt__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => window.print()}
              >
                Print receipt
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setReceipt(null)}
              >
                New sale
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pos-stat-bar">
        <div className="pos-stat">
          <span className="pos-stat__value">{filteredCatalog.length}</span>
          <span className="pos-stat__label">Items available</span>
        </div>
        <div className="pos-stat">
          <span className="pos-stat__value">{cartCount}</span>
          <span className="pos-stat__label">In cart</span>
        </div>
        <div className="pos-stat">
          <span className="pos-stat__value">{formatBrl(cartTotal)}</span>
          <span className="pos-stat__label">Cart total</span>
        </div>
      </div>

      <div className="pos-toolbar">
        <label>
          F&amp;B Stand
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={loadingLocations}
          >
            {locations.map((l) => (
              <option key={l.id ?? l._id} value={l.id ?? l._id}>{l.name}</option>
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
            placeholder="Item name or SKU…"
          />
        </label>
      </div>

      {selectedLocation && (
        <p className="link-muted" style={{ marginBottom: "1rem" }}>
          Stand: <strong>{selectedLocation.name}</strong>
          {selectedLocation.type && <span> · {selectedLocation.type}</span>}
          {loadingCatalog ? " · loading menu…" : ""}
        </p>
      )}

      <div className="pos-layout">
        <section>
          {loading ? (
            <p className="loading-text">Loading menu…</p>
          ) : filteredCatalog.length === 0 ? (
            <div className="empty">
              {search
                ? "No items match your search at this stand."
                : "No stock at this stand — receive inventory first."}
            </div>
          ) : (
            <div className="pos-product-grid pos-product-grid--fnb">
              {filteredCatalog.map((item) => (
                <article
                  key={item.sku.id}
                  className="pos-product pos-product--fnb"
                  onClick={() => addToCart(item)}
                  onKeyDown={(e) => e.key === "Enter" && addToCart(item)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="pos-product__body">
                    <h3 className="pos-product__name">{item.product?.name}</h3>
                    <p className="pos-product__price">{formatBrl(item.sku.priceCents)}</p>
                    <p className="link-muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                      {item.qtyAvailable ?? 0} left
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
                      Add
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="pos-cart pos-cart--sticky">
          <div className="pos-cart__head">
            <h3>Order</h3>
            <div className="pos-cart__count">{cartCount} item{cartCount === 1 ? "" : "s"}</div>
          </div>
          <div className="pos-cart__body">
            {cart.length === 0 ? (
              <p className="cart-empty">Tap an item to add it.</p>
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
                {submitting ? "Processing…" : "Complete order"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
