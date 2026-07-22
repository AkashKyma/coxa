import { useEffect, useState, useMemo } from "react";
import { api, formatBrl } from "../../lib/api.js";
import DataTable from "@coxa/ui/DataTable";
import { UtensilsCrossed, TrendingUp, Receipt, QrCode } from "lucide-react";
import { useClubAnalytics } from "../../lib/useClubAnalytics.js";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${color ?? "blue"}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
}

export default function FnbSalesDashboardPage() {
  const { track } = useClubAnalytics();
  const [allSales, setAllSales] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [todayOnly, setTodayOnly] = useState(true);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listLocations()
      .then((r) => {
        const locs = r.data?.locations ?? r.data ?? [];
        const fnbLocs = locs.filter((l) => l.type === "fnb_stand");
        setLocations(fnbLocs);
        if (fnbLocs.length) setLocationId(fnbLocs[0]._id ?? fnbLocs[0].id ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = { channel: "pos" };
    if (todayOnly) params.today = "true";
    if (locationId) params.locationId = locationId;
    setLoading(true);
    api.listSales(params)
      .then((r) => {
        setAllSales(r.data ?? []);
        track("fnb_sales_viewed", { todayOnly, locationId: locationId || "all" });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [todayOnly, locationId]);

  const fnbSales = useMemo(() => {
    if (!locationId) return allSales;
    return allSales.filter(
      (row) => (row.location?._id ?? row.location?.id ?? row.sale?.locationId) === locationId,
    );
  }, [allSales, locationId]);

  const totalRevenue = fnbSales.reduce((s, r) => s + (r.sale?.totalCents ?? 0), 0);
  const totalItems = fnbSales.reduce(
    (s, r) => s + (r.sale?.lines?.reduce((ls, l) => ls + (l.qty ?? 0), 0) ?? 0),
    0,
  );

  const columns = [
    {
      key: "number",
      header: "Sale #",
      render: ({ sale }) => <code className="code-token">{sale.saleNumber}</code>,
    },
    { key: "location", header: "Stand", render: ({ location }) => location?.name ?? "—" },
    {
      key: "items",
      header: "Items",
      render: ({ sale }) =>
        (sale.lines ?? []).map((l, i) => (
          <div key={i} style={{ fontSize: "0.8rem", marginBottom: "0.1rem" }}>
            {l.productName} <span className="link-muted">×{l.qty}</span>
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
      render: ({ sale }) => <span className="badge">{sale.paymentMethod ?? "—"}</span>,
    },
    {
      key: "qr",
      header: "",
      render: ({ sale }) =>
        sale.id ? (
          <a href={`/fnb/qr-redeem?saleId=${sale.id}`} className="btn btn--ghost btn--xs" title="View QR codes">
            <QrCode size={12} strokeWidth={2} />
          </a>
        ) : null,
    },
    {
      key: "time",
      header: "Time",
      render: ({ sale }) => (
        <span className="link-muted">{new Date(sale.createdAt).toLocaleTimeString()}</span>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <UtensilsCrossed size={22} strokeWidth={2} />
          <div>
            <h1>F&amp;B Sales</h1>
            <p className="page-header__sub">
              {locations.length > 0
                ? `Showing stand sales · ${locations.length} stand${locations.length === 1 ? "" : "s"} configured`
                : "No fnb_stand locations found"}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="alert alert--error mb-3">{error}</div>}

      <div className="stats-row">
        <StatCard icon={Receipt} label="Transactions" value={fnbSales.length} color="blue" />
        <StatCard icon={TrendingUp} label="Revenue" value={formatBrl(totalRevenue)} color="green" />
        <StatCard icon={UtensilsCrossed} label="Items sold" value={totalItems} color="orange" />
      </div>

      <div className="toolbar">
        <label className="toolbar__check">
          <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} />
          Today only
        </label>
        {locations.length > 0 && (
          <label className="toolbar__select">
            Stand
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l._id ?? l.id} value={l._id ?? l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        )}
        {locations.length === 0 && (
          <span className="text-muted text-sm">
            Create a location with type <code>fnb_stand</code> to filter here.
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={fnbSales}
        loading={loading}
        rowKey={({ sale }) => sale.id ?? sale.saleNumber}
        emptyMessage="No F&B sales for the selected stand and period."
      />
    </div>
  );
}
