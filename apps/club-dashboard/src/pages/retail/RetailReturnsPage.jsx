import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, formatBrl } from "../../lib/api.js";
import DataTable from "@coxa/ui/DataTable";

function getReturnRecord(row) {
  return row?.returnRecord ?? row?.return ?? null;
}

export default function RetailReturnsPage() {
  const location = useLocation();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saleId, setSaleId] = useState(location.state?.saleId ?? "");
  const [reason, setReason] = useState("");
  const [sale, setSale] = useState(null);
  const [qtyBySku, setQtyBySku] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function loadReturns() {
    setLoading(true);
    api
      .listReturns()
      .then((res) => {
        const rows = (res.data ?? []).map((row) => ({
          ...row,
          returnRecord: row.return ?? row.returnRecord ?? null,
        }));
        setReturns(rows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReturns();
  }, []);

  useEffect(() => {
    const id = location.state?.saleId;
    if (!id) return;
    setSaleId(id);
    api
      .getSale(id)
      .then((res) => {
        setSale(res.data);
        const initial = {};
        for (const line of res.data?.sale?.lines ?? []) {
          initial[line.skuId] = 0;
        }
        setQtyBySku(initial);
      })
      .catch((err) => setError(err.message));
  }, [location.state?.saleId]);

  async function loadSale(e) {
    e?.preventDefault();
    setError(null);
    setSale(null);
    try {
      const res = await api.getSale(saleId.trim());
      setSale(res.data);
      const initial = {};
      for (const line of res.data?.sale?.lines ?? []) {
        initial[line.skuId] = 0;
      }
      setQtyBySku(initial);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitReturn(e) {
    e.preventDefault();
    if (!sale?.sale) return;
    const lines = (sale.sale.lines ?? [])
      .filter((l) => Number(qtyBySku[l.skuId]) > 0)
      .map((l) => ({ skuId: l.skuId, qty: Number(qtyBySku[l.skuId]) }));
    if (lines.length === 0) {
      setError("Select at least one line with qty > 0");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createReturn({ saleId: sale.sale.id, reason, lines });
      setSale(null);
      setSaleId("");
      setReason("");
      setQtyBySku({});
      loadReturns();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const saleLines = sale?.sale?.lines ?? [];

  const returnLineColumns = sale
    ? [
        {
          key: "item",
          header: "Item",
          render: (l) => (
            <>
              {l.productName} <code>{l.skuCode}</code>
            </>
          ),
        },
        { key: "sold", header: "Sold", render: (l) => l.qty },
        {
          key: "returnQty",
          header: "Return qty",
          render: (l) => (
            <input
              type="number"
              min="0"
              max={l.qty}
              value={qtyBySku[l.skuId] ?? 0}
              onChange={(e) => setQtyBySku({ ...qtyBySku, [l.skuId]: e.target.value })}
              style={{ width: "5rem" }}
            />
          ),
        },
      ]
    : [];

  const recentReturnColumns = [
    {
      key: "number",
      header: "Return #",
      render: (row) => {
        const ret = getReturnRecord(row);
        return ret ? <code>{ret.returnNumber}</code> : "—";
      },
    },
    {
      key: "sale",
      header: "Sale",
      render: (row) => {
        const ret = getReturnRecord(row);
        return ret ? <code>{ret.saleNumber}</code> : "—";
      },
    },
    {
      key: "location",
      header: "Location",
      render: (row) => row.location?.name ?? "—",
    },
    {
      key: "total",
      header: "Total",
      render: (row) => {
        const ret = getReturnRecord(row);
        return ret ? <strong>{formatBrl(ret.totalCents)}</strong> : "—";
      },
    },
    {
      key: "reason",
      header: "Reason",
      className: "link-muted",
      render: (row) => {
        const ret = getReturnRecord(row);
        return ret?.reason || "—";
      },
    },
    {
      key: "time",
      header: "Time",
      className: "link-muted",
      render: (row) => {
        const ret = getReturnRecord(row);
        return ret?.createdAt ? new Date(ret.createdAt).toLocaleString() : "—";
      },
    },
  ];

  return (
    <div>
      <header className="page-header">
        <h1>Returns</h1>
        <p>Process returns against a completed sale — stock is restored at the sale location.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="panel">
        <h2 className="panel__title">New return</h2>
        <form onSubmit={loadSale} className="toolbar" style={{ marginBottom: "1rem" }}>
          <label>
            Sale ID
            <input
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
              placeholder="MongoDB sale id from Sales table"
              style={{ minWidth: "280px" }}
            />
          </label>
          <button type="submit" className="btn btn--secondary">
            Load sale
          </button>
        </form>

        {sale && (
          <form onSubmit={submitReturn}>
            <p className="panel__desc">
              <code>{sale.sale?.saleNumber}</code> · {sale.location?.name} ·{" "}
              {formatBrl(sale.sale?.totalCents ?? 0)}
            </p>
            <DataTable
              columns={returnLineColumns}
              data={saleLines}
              rowKey="skuId"
              pagination={false}
            />
            <div className="form-field" style={{ marginTop: "1rem" }}>
              <label className="field-label">Reason</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Defective, wrong size, etc."
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting}
              style={{ marginTop: "1rem" }}
            >
              {submitting ? "Processing…" : "Complete return"}
            </button>
          </form>
        )}
      </section>

      <h2 style={{ fontSize: "1.1rem", margin: "1.5rem 0 1rem" }}>Recent returns</h2>
      <DataTable
        columns={recentReturnColumns}
        data={returns}
        rowKey={(row, index) => getReturnRecord(row)?.id ?? `return-row-${index}`}
        loading={loading}
        emptyMessage="No returns yet."
      />

      <p className="link-muted" style={{ marginTop: "1rem" }}>
        Tip: copy sale ID from{" "}
        <Link to="/retail/sales">Sales</Link> (browser devtools or API response).
      </p>
    </div>
  );
}
