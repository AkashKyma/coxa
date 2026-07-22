import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { shopApi, formatBrl } from "../lib/api.js";

export default function ShopPage() {
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shopApi
      .catalog()
      .then((res) => setItems(res.data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function addToCart(item) {
    setSuccess(null);
    setCart((prev) => {
      const existing = prev.find((c) => c.sku.id === item.sku.id);
      const max = item.qtyAvailable;
      if (existing) {
        if (existing.qty >= max) return prev;
        return prev.map((c) =>
          c.sku.id === item.sku.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }

  function removeLine(skuId) {
    setCart((prev) => prev.filter((c) => c.sku.id !== skuId));
  }

  const cartTotal = cart.reduce((sum, line) => sum + line.sku.priceCents * line.qty, 0);
  const cartCount = cart.reduce((n, line) => n + line.qty, 0);

  async function checkout() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await shopApi.placeOrder({
        paymentMethod: "stub",
        lines: cart.map((line) => ({ skuId: line.sku.id, qty: line.qty })),
      });
      setSuccess(
        `Order ${res.data.sale.saleNumber} confirmed — ${formatBrl(res.data.sale.totalCents)}`,
      );
      setCart([]);
      const cat = await shopApi.catalog();
      setItems(cat.data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="page-header">
        <div className="brand brand--pill">Official store</div>
        <h1>Club shop</h1>
        <p>Jerseys, caps and scarves — delivered from our online warehouse.</p>
        <div className="page-header__actions">
          <Link to="/shop/orders">View my orders →</Link>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="commerce-layout">
        <section>
          {loading ? (
            <p className="loading-text">Loading products…</p>
          ) : items.length === 0 ? (
            <div className="empty">No items in stock online. Run npm run seed to load the fan shop.</div>
          ) : (
            <div className="product-grid">
              {items.map((item) => (
                <article key={item.sku.id} className="card product-card">
                  <div className="product-card__body">
                    <h3 className="product-card__title">{item.product.name}</h3>
                    {item.product.description && (
                      <p className="product-card__desc">{item.product.description}</p>
                    )}
                    <div className="product-card__meta">
                      <span className="badge">{item.sku.skuCode}</span>
                      {item.sku.variantLabel && (
                        <span className="badge">{item.sku.variantLabel}</span>
                      )}
                      <span className="badge badge--stock">{item.qtyAvailable} left</span>
                    </div>
                    <p className="product-card__price">{formatBrl(item.sku.priceCents)}</p>
                  </div>
                  <div className="product-card__footer">
                    <button type="button" className="btn btn--primary" onClick={() => addToCart(item)}>
                      Add to bag
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="card cart-panel cart-panel--sticky">
          <div className="cart-panel__head">
            <h3>Your bag {cartCount > 0 && `(${cartCount})`}</h3>
          </div>
          <div className="cart-panel__body">
            {cart.length === 0 ? (
              <p className="cart-empty">Your bag is empty. Add items from the catalog.</p>
            ) : (
              cart.map((line) => (
                <div key={line.sku.id} className="cart-line">
                  <div className="cart-line__info">
                    <span className="cart-line__name">{line.product.name}</span>
                    <span className="cart-line__qty">Qty {line.qty}</span>
                  </div>
                  <span className="cart-line__price">{formatBrl(line.sku.priceCents * line.qty)}</span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => removeLine(line.sku.id)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="cart-panel__foot">
            <div className="cart-total">
              <span>Total</span>
              <strong>{formatBrl(cartTotal)}</strong>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={cart.length === 0 || submitting}
              onClick={checkout}
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>
            <p className="field-hint" style={{ textAlign: "center", marginTop: "0.75rem" }}>
              Demo checkout — no real payment yet
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
