import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import DataTable from "@coxa/ui/DataTable";
import { useClubAnalytics } from "../../lib/useClubAnalytics.js";

const EVENT_TYPES = [
  { value: "", label: "All" },
  { value: "sale.completed", label: "Sales" },
  { value: "loyalty.points.earned", label: "Loyalty" },
  { value: "stock.transferred", label: "Inventory" },
  { value: "fan.registered", label: "Registration" },
  { value: "sale.returned", label: "Returns" },
];

function statusClass(status) {
  return `status-pill status-pill--${status ?? "accepted"}`;
}

export default function CdpEventsPage() {
  const { track } = useClubAnalytics();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  function load() {
    setLoading(true);
    const params = filter ? { eventName: filter } : {};
    api
      .listEvents(params)
      .then((res) => setEvents(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    if (filter) track("events_filtered", { eventType: filter });
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const accepted = events.filter((e) => e.status === "accepted").length;
  const withFan = events.filter((e) => e.fanProfileId).length;

  const columns = [
    {
      key: "time",
      header: "Timestamp",
      render: (ev) => new Date(ev.eventTimestamp ?? ev.createdAt).toLocaleString(),
    },
    { key: "event", header: "Event", render: (ev) => <span className="event-name">{ev.eventName}</span> },
    { key: "source", header: "Source", render: (ev) => ev.source },
    {
      key: "fan",
      header: "Fan",
      render: (ev) => ev.fanProfileId?.fullName ?? <span className="link-muted">System</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (ev) => <span className={statusClass(ev.status)}>{ev.status}</span>,
    },
    {
      key: "payload",
      header: "Payload",
      render: (ev) => (
        <span className="payload-preview" title={JSON.stringify(ev.payload)}>
          {JSON.stringify(ev.payload)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        module="Marketing & CDP"
        title="Event stream"
        description="Real-time domain events from sales, loyalty, inventory and fan activity. Events drive traits, segments and points."
        actions={
          <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi-card kpi-card--accent">
          <span className="kpi-card__value">{events.length}</span>
          <span className="kpi-card__label">Total events</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__value">{accepted}</span>
          <span className="kpi-card__label">Processed</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__value">{withFan}</span>
          <span className="kpi-card__label">Fan-linked</span>
        </div>
      </div>

      <div className="event-filters">
        {EVENT_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`event-chip${filter === t.value ? " active" : ""}`}
            onClick={() => setFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel-card">
        <div className="panel-card__head">
          <h3>Recent events</h3>
          <p>Newest first · idempotent ingestion with automatic trait & loyalty processing</p>
        </div>
        <div className="panel-card__body panel-card__body--flush">
          {events.length === 0 && !loading ? (
            <div className="empty-state">
              <p className="empty-state__title">No events yet</p>
              <p>Complete a POS sale with a fan email attached to see the event pipeline in action.</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={events}
              loading={loading}
              className="coxa-data-table-wrapper--flush"
              emptyMessage="No events yet"
            />
          )}
        </div>
      </div>
    </div>
  );
}
