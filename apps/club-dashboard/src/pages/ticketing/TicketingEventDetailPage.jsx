import { useEffect, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { CalendarDays, MapPin, ScanLine } from "lucide-react";

import { api, formatBrl } from "../../lib/api.js";

import PageHeader from "../../components/PageHeader.jsx";

import FormSidebar from "../../components/FormSidebar.jsx";

import DataTable from "@coxa/ui/DataTable";

import GateScanner from "../../components/ticketing/GateScanner.jsx";

import TicketQrModal from "../../components/ticketing/TicketQrModal.jsx";

import {

  EVENT_STATUS_LABELS,

  eventStatusBadge,

  ticketStatusBadge,

  formatEventDate,

} from "../../components/ticketing/ticketingUtils.js";



const TABS = [

  { id: "overview", label: "Overview" },

  { id: "products", label: "Products" },

  { id: "gate", label: "Gate scanner" },

  { id: "sales", label: "Box office" },

  { id: "tickets", label: "Tickets" },

];



const emptyProduct = {

  productCode: "",

  name: "",

  sectionCode: "",

  audienceType: "public",

  priceCents: "",

  capacity: "",

};



export default function TicketingEventDetailPage() {

  const { id } = useParams();

  const [data, setData] = useState(null);

  const [tickets, setTickets] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [tab, setTab] = useState("overview");

  const [productSidebar, setProductSidebar] = useState(false);

  const [productForm, setProductForm] = useState(emptyProduct);

  const [savingProduct, setSavingProduct] = useState(false);

  const [boxOffice, setBoxOffice] = useState({ ticketProductId: "", qty: 1, fanEmail: "" });

  const [checkInEmail, setCheckInEmail] = useState("fan@coxa.local");

  const [qrTicket, setQrTicket] = useState(null);

  const [gatePrefill, setGatePrefill] = useState(null);



  function load() {

    setLoading(true);

    Promise.all([api.getMatchEvent(id), api.listEventTickets(id)])

      .then(([detail, ticketRes]) => {

        setData(detail.data);

        setTickets(ticketRes.data ?? []);

        const products = detail.data.products ?? [];

        setBoxOffice((b) => ({

          ...b,

          ticketProductId: b.ticketProductId || products[0]?.id || "",

        }));

      })

      .catch((err) => setError(err.message))

      .finally(() => setLoading(false));

  }



  useEffect(() => {

    load();

  }, [id]);



  async function setStatus(status) {

    setError(null);

    try {

      await api.updateEventStatus(id, status);

      load();

    } catch (err) {

      setError(err.message);

    }

  }



  async function handleAddProduct(e) {

    e.preventDefault();

    setSavingProduct(true);

    setError(null);

    try {

      await api.createTicketProduct(id, {

        ...productForm,

        priceCents: Math.round(Number(productForm.priceCents) * 100),

        capacity: Number(productForm.capacity),

      });

      setProductForm(emptyProduct);

      setProductSidebar(false);

      load();

    } catch (err) {

      setError(err.message);

    } finally {

      setSavingProduct(false);

    }

  }



  async function sellTicket(e) {

    e.preventDefault();

    setError(null);

    try {

      await api.issueTickets({

        matchEventId: id,

        ticketProductId: boxOffice.ticketProductId,

        qty: Number(boxOffice.qty),

        fanEmail: boxOffice.fanEmail.trim() || undefined,

        channel: "box_office",

        paymentMethod: "cash",

      });

      load();

      setTab("tickets");

    } catch (err) {

      setError(err.message);

    }

  }



  async function memberCheckIn() {

    setError(null);

    const windowId = data?.checkInWindows?.[0]?.id;

    if (!windowId) {

      setError("No check-in window configured");

      return;

    }

    try {

      await api.memberCheckIn({

        matchEventId: id,

        checkInWindowId: windowId,

        fanEmail: checkInEmail,

      });

      load();

    } catch (err) {

      setError(err.message);

    }

  }



  function openGateWithToken(token) {

    setGatePrefill(token);

    setTab("gate");

  }



  if (loading) return <p className="muted">Loading event…</p>;

  if (!data?.event) return <p className="empty">Event not found.</p>;



  const { event, products, checkInWindows } = data;

  const venue = event.venueId;

  const issuedCount = tickets.filter((t) => t.status === "issued").length;

  const usedCount = tickets.filter((t) => t.status === "used").length;

  const totalSold = products.reduce((s, p) => s + (p.soldCount ?? 0), 0);

  const totalCapacity = products.reduce((s, p) => s + (p.capacity ?? 0), 0);



  const productColumns = [

    {

      key: "product",

      header: "Product",

      render: (p) => (

        <>

          <div className="cell-main">{p.name}</div>

          <div className="cell-sub">{p.productCode} · {p.sectionCode}</div>

        </>

      ),

    },

    { key: "price", header: "Price", render: (p) => formatBrl(p.priceCents) },

    { key: "sold", header: "Sold", render: (p) => p.soldCount ?? 0 },

    {

      key: "available",

      header: "Available",

      render: (p) => p.availableCount ?? Math.max(0, (p.capacity ?? 0) - (p.soldCount ?? 0) - (p.reservedCount ?? 0)),

    },

  ];



  const ticketColumns = [

    { key: "number", header: "Ticket", render: (t) => <code>{t.ticketNumber}</code> },

    { key: "product", header: "Product", render: (t) => t.ticketProductId?.name ?? "—" },

    {

      key: "section",

      header: "Section",

      render: (t) => t.sectionCode ?? t.ticketProductId?.sectionCode ?? "—",

    },

    {

      key: "status",

      header: "Status",

      render: (t) => (

        <span className={`event-status ${ticketStatusBadge(t.status)}`}>{t.status}</span>

      ),

    },

    {

      key: "qr",

      header: "QR pass",

      render: (t) => (

        <button

          type="button"

          className="btn btn--secondary btn--sm"

          disabled={t.status !== "issued"}

          onClick={() => setQrTicket(t)}

        >

          View QR

        </button>

      ),

    },

    {

      key: "gate",

      header: "",

      render: (t) =>

        t.status === "issued" ? (

          <button

            type="button"

            className="btn btn--ghost btn--sm"

            onClick={() => openGateWithToken(t.qrToken)}

          >

            Scan

          </button>

        ) : null,

    },

  ];



  const selectedProduct = products.find((p) => p.id === boxOffice.ticketProductId);



  return (

    <div className="event-manage">

      <PageHeader

        module="Ticketing"

        title={event.title}

        description={`${event.homeTeam ?? "Home"} vs ${event.awayTeam ?? "Away"} · ${formatEventDate(event.startsAt)}`}

        actions={

          <Link to="/ticketing/events" className="btn btn--ghost">

            ← All events

          </Link>

        }

      />



      {error && <div className="alert error">{error}</div>}



      <div className="event-hero">

        <div className="event-hero__meta">

          <span className={`event-status ${eventStatusBadge(event.status)}`}>

            {EVENT_STATUS_LABELS[event.status] ?? event.status}

          </span>

          {venue?.name && (

            <span className="event-hero__chip">

              <MapPin size={14} /> {venue.name}{venue.city ? `, ${venue.city}` : ""}

            </span>

          )}

          <span className="event-hero__chip">

            <CalendarDays size={14} /> {formatEventDate(event.startsAt)}

          </span>

        </div>

        <div className="event-hero__actions">

          {event.status !== "on_sale" && (

            <button type="button" className="btn btn--primary btn--sm" onClick={() => setStatus("on_sale")}>

              Put on sale

            </button>

          )}

          {event.status === "on_sale" && (

            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setStatus("sold_out")}>

              Mark sold out

            </button>

          )}

          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTab("gate")}>

            <ScanLine size={14} style={{ marginRight: "0.35rem", verticalAlign: "-2px" }} />

            Open gate

          </button>

        </div>

      </div>



      <div className="kpi-grid">

        <div className="kpi-card kpi-card--accent">

          <span className="kpi-card__value">{totalSold}</span>

          <span className="kpi-card__label">Tickets sold</span>

        </div>

        <div className="kpi-card">

          <span className="kpi-card__value">{issuedCount}</span>

          <span className="kpi-card__label">Active passes</span>

        </div>

        <div className="kpi-card">

          <span className="kpi-card__value">{usedCount}</span>

          <span className="kpi-card__label">Admitted at gate</span>

        </div>

        <div className="kpi-card">

          <span className="kpi-card__value">{products.length}</span>

          <span className="kpi-card__label">Products</span>

        </div>

        <div className="kpi-card">

          <span className="kpi-card__value">{totalCapacity.toLocaleString("pt-BR")}</span>

          <span className="kpi-card__label">Total capacity</span>

        </div>

      </div>



      <nav className="event-tabs" aria-label="Event sections">

        {TABS.map((t) => (

          <button

            key={t.id}

            type="button"

            className={`event-tabs__tab${tab === t.id ? " active" : ""}`}

            onClick={() => setTab(t.id)}

          >

            {t.label}

            {t.id === "tickets" && tickets.length > 0 && (

              <span className="event-tabs__count">{tickets.length}</span>

            )}

          </button>

        ))}

      </nav>



      {tab === "overview" && (

        <div className="workspace">

          <section className="panel-card">

            <div className="panel-card__head">

              <h3>Event details</h3>

              <p>Fixture configuration and matchday operations</p>

            </div>

            <div className="panel-card__body">

              <dl className="detail-list">

                <div><dt>Event code</dt><dd><code>{event.eventCode}</code></dd></div>

                <div><dt>Venue</dt><dd>{venue?.name ?? "—"}</dd></div>

                <div><dt>Gates open</dt><dd>{formatEventDate(event.gatesOpenAt)}</dd></div>

                <div><dt>Kickoff</dt><dd>{formatEventDate(event.startsAt)}</dd></div>

                <div><dt>Sale window</dt><dd>{formatEventDate(event.saleStartsAt)} → {formatEventDate(event.saleEndsAt)}</dd></div>

              </dl>

              <div className="toolbar" style={{ marginTop: "1.25rem" }}>

                <button type="button" className="btn btn--ghost btn--sm" onClick={() => api.recordNoShows(id).then(load)}>

                  Record no-shows

                </button>

              </div>

            </div>

          </section>



          <aside className="panel-card">

            <div className="panel-card__head">

              <h3>Member check-in</h3>

              <p>Season ticket / member zone access</p>

            </div>

            <div className="panel-card__body">

              {checkInWindows.length === 0 ? (

                <p className="muted">No check-in windows configured.</p>

              ) : (

                <div className="form-grid">

                  <div className="form-field form-field--full">

                    <label className="field-label">Window</label>

                    <p className="panel__desc">

                      {checkInWindows[0].name} · {checkInWindows[0].checkedInCount}/{checkInWindows[0].capacity} checked in

                    </p>

                  </div>

                  <div className="form-field form-field--full">

                    <label className="field-label">Member email</label>

                    <input value={checkInEmail} onChange={(e) => setCheckInEmail(e.target.value)} />

                  </div>

                  <button type="button" className="btn btn--secondary" onClick={memberCheckIn}>

                    Check in member

                  </button>

                </div>

              )}

            </div>

          </aside>

        </div>

      )}



      {tab === "products" && (

        <div className="panel-card">

          <div className="panel-card__head">

            <div>

              <h3>Ticket products</h3>

              <p>Pricing tiers and section capacity for this fixture</p>

            </div>

            <button type="button" className="btn btn--primary btn--sm" onClick={() => setProductSidebar(true)}>

              Add product

            </button>

          </div>

          <div className="panel-card__body panel-card__body--flush">

            <DataTable

              columns={productColumns}

              data={products}

              pagination={false}

              className="coxa-data-table-wrapper--flush"

              emptyMessage="No ticket products — add one to start selling."

            />

          </div>

        </div>

      )}



      {tab === "gate" && (

        <div className="panel-card">

          <div className="panel-card__body">

            <GateScanner
              matchEventId={id}
              eventTitle={event.title}
              initialToken={gatePrefill ?? ""}
              onAdmitted={() => {
                load();
                setGatePrefill(null);
              }}
            />

          </div>

        </div>

      )}



      {tab === "sales" && (

        <div className="workspace">

          <section className="panel-card">

            <div className="panel-card__head">

              <h3>Box office sale</h3>

              <p>Issue tickets at the stadium counter</p>

            </div>

            <div className="panel-card__body">

              <form onSubmit={sellTicket} className="form-grid">

                <div className="form-field form-field--full">

                  <label className="field-label">Ticket product</label>

                  <select

                    value={boxOffice.ticketProductId}

                    onChange={(e) => setBoxOffice((b) => ({ ...b, ticketProductId: e.target.value }))}

                  >

                    {products.map((p) => (

                      <option key={p.id} value={p.id}>

                        {p.name} — {formatBrl(p.priceCents)} ({p.availableCount ?? 0} left)

                      </option>

                    ))}

                  </select>

                </div>

                <div className="form-field">

                  <label className="field-label">Quantity</label>

                  <input

                    type="number"

                    min="1"

                    max="6"

                    value={boxOffice.qty}

                    onChange={(e) => setBoxOffice((b) => ({ ...b, qty: e.target.value }))}

                  />

                </div>

                <div className="form-field">

                  <label className="field-label">Fan email</label>

                  <input

                    type="email"

                    value={boxOffice.fanEmail}

                    onChange={(e) => setBoxOffice((b) => ({ ...b, fanEmail: e.target.value }))}

                    placeholder="Optional"

                  />

                </div>

                {selectedProduct && (

                  <div className="form-field form-field--full">

                    <p className="panel__desc">

                      Total: <strong>{formatBrl(selectedProduct.priceCents * Number(boxOffice.qty))}</strong>

                    </p>

                  </div>

                )}

                <button type="submit" className="btn btn--primary">Issue tickets (cash)</button>

              </form>

            </div>

          </section>

        </div>

      )}



      {tab === "tickets" && (

        <div className="panel-card">

          <div className="panel-card__head">

            <h3>Issued tickets</h3>

            <p>QR passes linked to gate validation — {usedCount} admitted, {issuedCount} pending</p>

          </div>

          <div className="panel-card__body panel-card__body--flush">

            <DataTable

              columns={ticketColumns}

              data={tickets}

              className="coxa-data-table-wrapper--flush"

              emptyMessage="No tickets issued yet. Use box office or fan shop."

            />

          </div>

        </div>

      )}



      <FormSidebar

        open={productSidebar}

        title="Add ticket product"

        description="Create a new price tier for this event."

        onClose={() => setProductSidebar(false)}

        footer={

          <>

            <button type="button" className="btn btn--ghost" onClick={() => setProductSidebar(false)}>Cancel</button>

            <button type="submit" form="product-form" className="btn btn--primary" disabled={savingProduct}>

              {savingProduct ? "Saving…" : "Add product"}

            </button>

          </>

        }

      >

        <form id="product-form" onSubmit={handleAddProduct} className="form-grid">

          <div className="form-field">

            <label className="field-label">Product code</label>

            <input required value={productForm.productCode} onChange={(e) => setProductForm((f) => ({ ...f, productCode: e.target.value }))} />

          </div>

          <div className="form-field">

            <label className="field-label">Name</label>

            <input required value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} />

          </div>

          <div className="form-field">

            <label className="field-label">Section code</label>

            <input value={productForm.sectionCode} onChange={(e) => setProductForm((f) => ({ ...f, sectionCode: e.target.value }))} placeholder="NORTE" />

          </div>

          <div className="form-field">

            <label className="field-label">Audience</label>

            <select value={productForm.audienceType} onChange={(e) => setProductForm((f) => ({ ...f, audienceType: e.target.value }))}>

              <option value="public">Public</option>

              <option value="member">Member</option>

              <option value="vip">VIP</option>

            </select>

          </div>

          <div className="form-field">

            <label className="field-label">Price (R$)</label>

            <input type="number" step="0.01" required value={productForm.priceCents} onChange={(e) => setProductForm((f) => ({ ...f, priceCents: e.target.value }))} />

          </div>

          <div className="form-field">

            <label className="field-label">Capacity</label>

            <input type="number" required value={productForm.capacity} onChange={(e) => setProductForm((f) => ({ ...f, capacity: e.target.value }))} />

          </div>

        </form>

      </FormSidebar>



      <TicketQrModal

        ticket={qrTicket}

        onClose={() => setQrTicket(null)}

        onScanAtGate={openGateWithToken}

      />

    </div>

  );

}

