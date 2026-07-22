import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function availabilityLabel(code) {
  const map = {
    ok: { text: "OK", className: "status-pill event-status--sale" },
    expiring_soon: { text: "Expiring soon", className: "status-pill event-status--soldout" },
    past_sell_by: { text: "Past sell-by", className: "status-pill event-status--cancelled" },
    expired: { text: "Expired", className: "status-pill event-status--cancelled" },
    active: { text: "Active", className: "status-pill event-status--draft" },
    depleted: { text: "Depleted", className: "status-pill event-status--draft" },
    wasted: { text: "Wasted", className: "status-pill event-status--draft" },
    quarantine: { text: "Quarantine", className: "status-pill event-status--soldout" },
  };
  return map[code] ?? { text: code, className: "status-pill event-status--draft" };
}

const EMPTY_RECEIVE = {
  skuId: "",
  locationId: "",
  qty: "",
  lotNumber: "",
  purchaseDate: "",
  expirationDate: "",
  sellByDate: "",
  supplierName: "",
  note: "",
};

export default function FoodInventoryPage() {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [foodSkus, setFoodSkus] = useState([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAvailability, setFilterAvailability] = useState("");
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState("receive");
  const [receive, setReceive] = useState(EMPTY_RECEIVE);
  const [wastage, setWastage] = useState(null);

  function load() {
    const params = {};
    if (filterLocation) params.locationId = filterLocation;
    if (filterAvailability === "expiring") params.expiringWithinDays = 3;

    Promise.all([api.listFoodLots(params), api.listLocations(), api.listProducts()])
      .then(([lotsRes, locs, productsRes]) => {
        setRows(lotsRes.data ?? []);
        setLocations(locs.data ?? []);

        const trackLotProducts = new Set(
          (productsRes.data ?? []).filter((p) => p.trackLots).map((p) => p.id),
        );

        Promise.all(
          (productsRes.data ?? [])
            .filter((p) => p.trackLots)
            .map((p) => api.getProduct(p.id)),
        ).then((details) => {
          const skus = details.flatMap((d) =>
            (d.data?.skus ?? []).map((sku) => ({
              ...sku,
              productName: d.data?.product?.name,
              productId: d.data?.product?.id,
            })),
          );
          setFoodSkus(skus.filter((s) => trackLotProducts.has(s.productId)));
        });

        const fnbLoc =
          locs.data?.find((l) => l.type === "fnb_stand") ?? locs.data?.[0];
        if (fnbLoc && !receive.locationId) {
          setReceive((r) => ({ ...r, locationId: fnbLoc.id }));
        }
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [filterLocation, filterAvailability]);

  const filteredRows = useMemo(() => {
    if (!filterAvailability || filterAvailability === "expiring") return rows;
    return rows.filter((r) => r.availability === filterAvailability);
  }, [rows, filterAvailability]);

  const kpis = useMemo(() => {
    const active = rows.filter((r) => r.status === "active" && r.qtyOnHand > 0);
    return {
      lots: active.length,
      units: active.reduce((s, r) => s + r.qtyOnHand, 0),
      expiring: rows.filter((r) => r.availability === "expiring_soon").length,
      blocked: rows.filter(
        (r) => r.availability === "past_sell_by" || r.availability === "expired",
      ).length,
    };
  }, [rows]);

  async function submitReceive(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.receiveFoodLot({
        locationId: receive.locationId,
        skuId: receive.skuId,
        qty: Number(receive.qty),
        lotNumber: receive.lotNumber || undefined,
        purchaseDate: receive.purchaseDate || undefined,
        expirationDate: receive.expirationDate,
        sellByDate: receive.sellByDate || undefined,
        supplierName: receive.supplierName || undefined,
        note: receive.note || "Food lot receive",
      });
      setReceive({ ...EMPTY_RECEIVE, locationId: receive.locationId });
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitWastage(e) {
    e.preventDefault();
    if (!wastage) return;
    setError(null);
    try {
      await api.recordLotWastage(wastage.lotId, {
        qty: Number(wastage.qty),
        reason: wastage.reason,
      });
      setWastage(null);
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runMarkExpired() {
    setError(null);
    try {
      const res = await api.markExpiredLots();
      load();
      setError(null);
      alert(`Marked ${res.data?.markedExpired ?? 0} expired lot(s) and wrote off stock.`);
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: "lotNumber", header: "Lot", render: (r) => r.lotNumber },
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div>
          <strong>{r.productName}</strong>
          <div className="link-muted">{r.skuCode}</div>
        </div>
      ),
    },
    { key: "location", header: "Location", render: (r) => r.locationName },
    { key: "qty", header: "Qty", render: (r) => r.qtyOnHand },
    { key: "purchase", header: "Purchased", render: (r) => fmtDate(r.purchaseDate) },
    { key: "sellBy", header: "Sell by", render: (r) => fmtDate(r.sellByDate) },
    { key: "expires", header: "Expires", render: (r) => fmtDate(r.expirationDate) },
    {
      key: "availability",
      header: "Availability",
      render: (r) => {
        const badge = availabilityLabel(r.availability);
        return <span className={badge.className}>{badge.text}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.qtyOnHand > 0 && r.status === "active" ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setSidebarMode("wastage");
              setWastage({
                lotId: r.id,
                lotNumber: r.lotNumber,
                maxQty: r.qtyOnHand,
                qty: r.qtyOnHand,
                reason: "Spoilage",
              });
              setSidebarOpen(true);
            }}
          >
            Wastage
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Food inventory"
        subtitle="Lot tracking with purchase, sell-by and expiration dates (FEFO on POS sales)"
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={runMarkExpired}>
              Mark expired lots
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setSidebarMode("receive");
                setWastage(null);
                setSidebarOpen(true);
              }}
            >
              Receive lot
            </button>
          </>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <div className="kpi-grid" style={{ marginBottom: "1.25rem" }}>
        <div className="kpi-card">
          <span className="kpi-card__label">Active lots</span>
          <span className="kpi-card__value">{kpis.lots}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Units on hand</span>
          <span className="kpi-card__value">{kpis.units}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Expiring ≤ 3 days</span>
          <span className="kpi-card__value">{kpis.expiring}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label">Past sell-by / expired</span>
          <span className="kpi-card__value">{kpis.blocked}</span>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: "1rem" }}>
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
        <label>
          Availability
          <select
            value={filterAvailability}
            onChange={(e) => setFilterAvailability(e.target.value)}
          >
            <option value="">All</option>
            <option value="expiring">Expiring within 3 days</option>
            <option value="expiring_soon">Expiring soon only</option>
            <option value="past_sell_by">Past sell-by</option>
            <option value="expired">Expired</option>
            <option value="ok">Sellable</option>
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        rowKey="id"
        emptyMessage="No food lots yet — receive stock with dates."
        pagination={filteredRows.length > 10}
      />

      <FormSidebar
        open={sidebarOpen}
        title={sidebarMode === "receive" ? "Receive food lot" : "Record wastage"}
        description={
          sidebarMode === "receive"
            ? "Log a batch with purchase, sell-by and expiration dates."
            : "Write off spoiled or damaged stock."
        }
        onClose={() => {
          setSidebarOpen(false);
          setWastage(null);
        }}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSidebarOpen(false);
                setWastage(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" form="food-lot-form" className="btn btn--primary">
              {sidebarMode === "receive" ? "Receive lot" : "Record wastage"}
            </button>
          </>
        }
      >
        {sidebarMode === "receive" ? (
          <form id="food-lot-form" onSubmit={submitReceive} className="form-grid">
            <div className="form-field form-field--full">
              <label className="field-label">Location</label>
              <select
                required
                value={receive.locationId}
                onChange={(e) => setReceive({ ...receive, locationId: e.target.value })}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Product (lot-tracked SKU)</label>
              <select
                required
                value={receive.skuId}
                onChange={(e) => setReceive({ ...receive, skuId: e.target.value })}
              >
                <option value="">Select SKU…</option>
                {foodSkus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.productName} — {s.skuCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={receive.qty}
                onChange={(e) => setReceive({ ...receive, qty: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="field-label">Lot / batch number</label>
              <input
                value={receive.lotNumber}
                onChange={(e) => setReceive({ ...receive, lotNumber: e.target.value })}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Purchase date</label>
              <input
                type="date"
                value={receive.purchaseDate}
                onChange={(e) => setReceive({ ...receive, purchaseDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="field-label">Expiration date</label>
              <input
                type="date"
                required
                value={receive.expirationDate}
                onChange={(e) => setReceive({ ...receive, expirationDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="field-label">Sell-by date</label>
              <input
                type="date"
                value={receive.sellByDate}
                onChange={(e) => setReceive({ ...receive, sellByDate: e.target.value })}
              />
              <span className="field-hint">Optional — defaults from expiration minus buffer</span>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Supplier</label>
              <input
                value={receive.supplierName}
                onChange={(e) => setReceive({ ...receive, supplierName: e.target.value })}
              />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Note</label>
              <input
                value={receive.note}
                onChange={(e) => setReceive({ ...receive, note: e.target.value })}
              />
            </div>
          </form>
        ) : (
          wastage && (
            <form id="food-lot-form" onSubmit={submitWastage} className="form-grid">
              <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
                Lot <strong>{wastage.lotNumber}</strong> — max {wastage.maxQty} units
              </p>
              <div className="form-field">
                <label className="field-label">Wastage quantity</label>
                <input
                  type="number"
                  min="1"
                  max={wastage.maxQty}
                  required
                  value={wastage.qty}
                  onChange={(e) => setWastage({ ...wastage, qty: e.target.value })}
                />
              </div>
              <div className="form-field form-field--full">
                <label className="field-label">Reason</label>
                <input
                  required
                  value={wastage.reason}
                  onChange={(e) => setWastage({ ...wastage, reason: e.target.value })}
                />
              </div>
            </form>
          )
        )}
      </FormSidebar>
    </div>
  );
}
