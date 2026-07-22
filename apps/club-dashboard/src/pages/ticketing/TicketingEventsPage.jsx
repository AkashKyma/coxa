import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";
import {
  EVENT_STATUS_LABELS,
  eventStatusBadge,
  formatEventDate,
} from "../../components/ticketing/ticketingUtils.js";

const emptyForm = {
  eventCode: "",
  title: "",
  homeTeam: "",
  awayTeam: "",
  venueId: "",
  startsAt: "",
  status: "draft",
};

export default function TicketingEventsPage() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  function load() {
    setLoading(true);
    Promise.all([api.listMatchEvents(), api.listVenues()])
      .then(([evRes, venRes]) => {
        setEvents(evRes.data);
        setVenues(venRes.data);
        setForm((f) => ({ ...f, venueId: f.venueId || venRes.data[0]?.id || "" }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.createMatchEvent({
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        saleStartsAt: new Date().toISOString(),
      });
      setForm((f) => ({ ...emptyForm, venueId: f.venueId }));
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const filtered = statusFilter
    ? events.filter((ev) => ev.status === statusFilter)
    : events;

  const onSale = events.filter((e) => e.status === "on_sale").length;
  const upcoming = events.filter((e) => new Date(e.startsAt) >= new Date()).length;

  const columns = [
    {
      key: "event",
      header: "Event",
      render: (ev) => (
        <>
          <div className="cell-main">{ev.title}</div>
          <div className="cell-sub">{ev.eventCode}</div>
        </>
      ),
    },
    {
      key: "match",
      header: "Fixture",
      render: (ev) => `${ev.homeTeam ?? "—"} vs ${ev.awayTeam ?? "—"}`,
    },
    {
      key: "venue",
      header: "Venue",
      render: (ev) => ev.venueId?.name ?? "—",
    },
    { key: "date", header: "Kickoff", render: (ev) => formatEventDate(ev.startsAt) },
    {
      key: "status",
      header: "Status",
      render: (ev) => (
        <span className={`event-status ${eventStatusBadge(ev.status)}`}>
          {EVENT_STATUS_LABELS[ev.status] ?? ev.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (ev) => (
        <Link to={`/ticketing/events/${ev.id}`} className="btn btn--secondary btn--sm">
          Manage
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        module="Ticketing"
        title="Match events"
        description="Fixtures, ticket products, gate scanner and box office sales."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setSidebarOpen(true)}>
            Create event
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
          <span className="kpi-card__value">{onSale}</span>
          <span className="kpi-card__label">On sale</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__value">{upcoming}</span>
          <span className="kpi-card__label">Upcoming</span>
        </div>
      </div>

      <div className="event-filters">
        <button
          type="button"
          className={`event-chip${!statusFilter ? " active" : ""}`}
          onClick={() => setStatusFilter("")}
        >
          All
        </button>
        {["draft", "on_sale", "sold_out", "completed"].map((s) => (
          <button
            key={s}
            type="button"
            className={`event-chip${statusFilter === s ? " active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {EVENT_STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="No events yet. Create one or run seed."
      />

      <FormSidebar
        open={sidebarOpen}
        title="Create event"
        description="Set up a new match or activation."
        onClose={() => setSidebarOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSidebarOpen(false)}>Cancel</button>
            <button type="submit" form="event-form" className="btn btn--primary" disabled={creating}>
              {creating ? "Creating…" : "Create event"}
            </button>
          </>
        }
      >
        <form id="event-form" onSubmit={handleCreate} className="form-grid">
          <div className="form-field form-field--full">
            <label className="field-label">Event code</label>
            <input required value={form.eventCode} onChange={(e) => setForm((f) => ({ ...f, eventCode: e.target.value }))} placeholder="COXA-2026-06" />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Title</label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-field">
            <label className="field-label">Home team</label>
            <input value={form.homeTeam} onChange={(e) => setForm((f) => ({ ...f, homeTeam: e.target.value }))} />
          </div>
          <div className="form-field">
            <label className="field-label">Away team</label>
            <input value={form.awayTeam} onChange={(e) => setForm((f) => ({ ...f, awayTeam: e.target.value }))} />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Venue</label>
            <select required value={form.venueId} onChange={(e) => setForm((f) => ({ ...f, venueId: e.target.value }))}>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Kickoff</label>
            <input type="datetime-local" required value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
          </div>
        </form>
      </FormSidebar>
    </div>
  );
}
