import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatBrl } from "../../lib/api.js";
import DataTable from "@coxa/ui/DataTable";
import { useClubAnalytics } from "../../lib/useClubAnalytics.js";

export default function RetailSalesPage() {
  const { track } = useClubAnalytics();
  const [sales, setSales] = useState([]);
  const [error, setError] = useState(null);
  const [todayOnly, setTodayOnly] = useState(true);
  const [channel, setChannel] = useState("");

  function load() {
    const params = {};
    if (todayOnly) params.today = "true";
    if (channel) params.channel = channel;
    api
      .listSales(params)
      .then((res) => setSales(res.data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    track("retail_sales_viewed", { todayOnly, channel: channel || "all" });
  }, [todayOnly, channel]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalRevenue = sales.reduce((s, row) => s + (row.sale?.totalCents ?? 0), 0);

  const columns = [
    { key: "number", header: "Sale #", render: ({ sale }) => <code>{sale.saleNumber}</code> },
    {
      key: "channel",
      header: "Channel",
      render: ({ sale }) => (
        <span className="badge">{sale.channel === "fan_shop" ? "Fan shop" : "POS"}</span>
      ),
    },
    { key: "location", header: "Location", render: ({ location }) => location?.name },
    {
      key: "items",
      header: "Items",
      render: ({ sale }) =>
        sale.lines?.map((l) => (
          <div key={l.skuCode} style={{ marginBottom: "0.2rem", fontSize: "0.85rem" }}>
            {l.productName} ×{l.qty}
          </div>
        )),
    },
    {
      key: "total",
      header: "Total",
      render: ({ sale }) => <strong>{formatBrl(sale.totalCents)}</strong>,
    },
    {
      key: "payment",
      header: "Payment",
      className: "link-muted",
      render: ({ sale }) => sale.paymentMethod,
    },
    {
      key: "time",
      header: "Time",
      className: "link-muted",
      render: ({ sale }) => new Date(sale.createdAt).toLocaleString(),
    },
    {
      key: "actions",
      header: "",
      render: ({ sale }) => (
        <Link to="/retail/returns" state={{ saleId: sale.id }} className="btn btn--secondary btn--sm">
          Return
        </Link>
      ),
    },
  ];

  return (
    <div>
      <header className="page-header">
        <h1>Sales</h1>
        <p>POS and fan shop transactions.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div className="stats">
        <div className="stat">
          <strong>{sales.length}</strong>
          <span>Transactions</span>
        </div>
        <div className="stat">
          <strong>{formatBrl(totalRevenue)}</strong>
          <span>Revenue</span>
        </div>
      </div>

      <div className="toolbar">
        <label>
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
          />
          Today only
        </label>
        <label>
          Channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">All</option>
            <option value="pos">POS</option>
            <option value="fan_shop">Fan shop</option>
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        data={sales}
        rowKey={({ sale }) => sale.id}
        emptyMessage="No sales — use POS (5177) or fan shop (5176)."
      />
    </div>
  );
}
