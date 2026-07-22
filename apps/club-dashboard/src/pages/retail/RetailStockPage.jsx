import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";

export default function RetailStockPage() {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState("receive");
  const [adjust, setAdjust] = useState(null);
  const [receive, setReceive] = useState({
    skuId: "",
    locationId: "",
    qty: "",
    note: "",
  });
  const [lowStockExpanded, setLowStockExpanded] = useState(false);
  const LOW_STOCK_PREVIEW = 5;

  function load() {
    const params = filterLocation ? { locationId: filterLocation } : {};
    Promise.all([
      api.listStock(params),
      api.listLocations(),
      api.fetchCatalog(),
      api.lowStockAlerts(),
    ])
      .then(([stock, locs, cat, alerts]) => {
        setRows(stock.data);
        setLocations(locs.data);
        setCatalog(cat.data);
        setLowStock(alerts.data);
        if (!receive.locationId && locs.data[0]) {
          setReceive((r) => ({ ...r, locationId: locs.data[0].id }));
        }
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [filterLocation]);

  async function syncCatalog() {
    setError(null);
    try {
      await api.syncStockCatalog();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitReceive(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.receiveStock({
        locationId: receive.locationId,
        skuId: receive.skuId,
        qty: Number(receive.qty),
        note: receive.note || "Stock receive",
      });
      setReceive((r) => ({ ...r, qty: "", note: "" }));
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitAdjustment(e) {
    e.preventDefault();
    if (!adjust) return;
    setError(null);
    try {
      await api.createStockAdjustment({
        locationId: adjust.locationId,
        skuId: adjust.skuId,
        qtyDelta: Number(adjust.qtyDelta),
        note: adjust.note,
      });
      setAdjust(null);
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Balances by location — receive, adjust, or sync new catalog items."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => { setSidebarMode("receive"); setSidebarOpen(true); }}>
            Receive stock
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      {lowStock.length > 0 && (
        <div className="alert error stock-alert">
          <div className="stock-alert__header">
            <strong>Low stock alert — {lowStock.length} item(s)</strong>
            {lowStock.length > LOW_STOCK_PREVIEW && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setLowStockExpanded((open) => !open)}
              >
                {lowStockExpanded ? "Show less" : `View all ${lowStock.length}`}
              </button>
            )}
          </div>
          <ul className="stock-alert__list">
            {(lowStockExpanded ? lowStock : lowStock.slice(0, LOW_STOCK_PREVIEW)).map((a) => (
              <li key={`${a.sku?.id}-${a.location?.id}`}>
                {a.product?.name} (<code>{a.sku?.skuCode}</code>) @ {a.location?.name}:{" "}
                <span className="badge badge--low">{a.qtyOnHand}</span> / min {a.minQty}
              </li>
            ))}
          </ul>
          {!lowStockExpanded && lowStock.length > LOW_STOCK_PREVIEW && (
            <p className="stock-alert__more">
              + {lowStock.length - LOW_STOCK_PREVIEW} more item(s) below minimum stock
            </p>
          )}
        </div>
      )}


      <div className="toolbar">
        <label>
          Location
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--secondary" onClick={syncCatalog}>
          Sync catalog (0 qty rows)
        </button>
        <span className="link-muted">{rows.length} balance row(s)</span>
      </div>

      <DataTable
        columns={[
          { key: "sku", header: "SKU", render: (row) => <code>{row.sku?.skuCode}</code> },
          { key: "product", header: "Product", render: (row) => row.product?.name },
          {
            key: "location",
            header: "Location",
            render: (row) => <span className="badge">{row.location?.name}</span>,
          },
          {
            key: "qty",
            header: "Qty",
            render: (row) => <strong>{row.qtyOnHand}</strong>,
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  setSidebarMode("adjust");
                  setAdjust({
                    locationId: row.location?.id,
                    skuId: row.sku?.id,
                    skuCode: row.sku?.skuCode,
                    qtyDelta: "",
                    note: "",
                  });
                  setSidebarOpen(true);
                }}
              >
                Adjust
              </button>
            ),
          },
        ]}
        data={rows}
        emptyMessage="No stock — sync catalog or receive stock above."
      />

      <FormSidebar
        open={sidebarOpen}
        title={sidebarMode === "receive" ? "Receive stock" : `Adjust — ${adjust?.skuCode ?? ""}`}
        description={sidebarMode === "receive" ? "Add quantity for existing products." : "Apply a quantity change (+ in / − out)."}
        onClose={() => { setSidebarOpen(false); setAdjust(null); }}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => { setSidebarOpen(false); setAdjust(null); }}>Cancel</button>
            <button type="submit" form="stock-form" className="btn btn--primary">
              {sidebarMode === "receive" ? "Receive stock" : "Apply adjustment"}
            </button>
          </>
        }
      >
        {sidebarMode === "receive" ? (
          <form id="stock-form" onSubmit={submitReceive} className="form-grid">
            <div className="form-field form-field--full">
              <label className="field-label">Product / SKU</label>
              <select required value={receive.skuId} onChange={(e) => setReceive({ ...receive, skuId: e.target.value })}>
                <option value="">Select product…</option>
                {catalog.map((item) => (
                  <option key={item.sku.id} value={item.sku.id}>{item.product?.name} — {item.sku.skuCode}</option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Location</label>
              <select required value={receive.locationId} onChange={(e) => setReceive({ ...receive, locationId: e.target.value })}>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Quantity</label>
              <input required type="number" min="1" value={receive.qty} onChange={(e) => setReceive({ ...receive, qty: e.target.value })} />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Note</label>
              <input value={receive.note} onChange={(e) => setReceive({ ...receive, note: e.target.value })} />
            </div>
          </form>
        ) : (
          adjust && (
            <form id="stock-form" onSubmit={submitAdjustment} className="form-grid">
              <div className="form-field form-field--full">
                <label className="field-label">Qty change (+ in / − out)</label>
                <input required type="number" value={adjust.qtyDelta} onChange={(e) => setAdjust({ ...adjust, qtyDelta: e.target.value })} />
              </div>
              <div className="form-field form-field--full">
                <label className="field-label">Note</label>
                <input value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
              </div>
            </form>
          )
        )}
      </FormSidebar>
    </div>
  );
}
