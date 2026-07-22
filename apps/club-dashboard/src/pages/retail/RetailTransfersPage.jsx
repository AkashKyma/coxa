import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";

export default function RetailTransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [skuId, setSkuId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  function load() {
    Promise.all([api.listTransfers(), api.listLocations(), api.fetchCatalog()])
      .then(([t, locs, cat]) => {
        setTransfers(t.data);
        setLocations(locs.data);
        setCatalog(cat.data);
        if (!fromLocationId && locs.data[0]) {
          setFromLocationId(locs.data.find((l) => l.code === "warehouse")?.id ?? locs.data[0].id);
        }
        if (!toLocationId && locs.data[1]) {
          setToLocationId(locs.data.find((l) => l.code === "stadium_store")?.id ?? locs.data[1]?.id ?? "");
        }
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createTransfer({
        fromLocationId,
        toLocationId,
        note: note || undefined,
        lines: [{ skuId, qty: Number(qty) }],
      });
      setQty("1");
      setNote("");
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: "number", header: "Transfer #", render: ({ transfer }) => <code>{transfer.transferNumber}</code> },
    {
      key: "route",
      header: "From → To",
      render: ({ from, to }) => `${from?.name ?? "—"} → ${to?.name ?? "—"}`,
    },
    {
      key: "lines",
      header: "Lines",
      render: ({ transfer }) =>
        transfer.lines.map((l) => (
          <div key={l.skuCode}><code>{l.skuCode}</code> ×{l.qty}</div>
        )),
    },
    {
      key: "note",
      header: "Note",
      className: "link-muted",
      render: ({ transfer }) => transfer.note || "—",
    },
    {
      key: "time",
      header: "Time",
      className: "link-muted",
      render: ({ transfer }) => new Date(transfer.createdAt).toLocaleString(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stock transfers"
        description="Move inventory between locations — debits source and credits destination."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setSidebarOpen(true)}>
            New transfer
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <DataTable
        columns={columns}
        data={transfers}
        rowKey={({ transfer }) => transfer.id}
        emptyMessage="No transfers yet."
      />

      <FormSidebar
        open={sidebarOpen}
        title="New transfer"
        description="Move stock from one location to another."
        onClose={() => setSidebarOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSidebarOpen(false)}>Cancel</button>
            <button type="submit" form="transfer-form" className="btn btn--primary">Transfer stock</button>
          </>
        }
      >
        <form id="transfer-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-field form-field--full">
            <label className="field-label">From</label>
            <select required value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">To</label>
            <select required value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">SKU</label>
            <select required value={skuId} onChange={(e) => setSkuId(e.target.value)}>
              <option value="">Select SKU…</option>
              {catalog.map(({ sku, product }) => (
                <option key={sku.id} value={sku.id}>{product?.name} — {sku.skuCode}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Quantity</label>
            <input type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </form>
      </FormSidebar>
    </div>
  );
}
