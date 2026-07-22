import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import DataTable from "@coxa/ui/DataTable";
import { Percent, Gift, Sparkles, Truck, Tag } from "lucide-react";

const OFFER_TYPE_META = {
  discount_percent: { label: "Discount %", icon: Percent, color: "#f59e0b" },
  discount_fixed:   { label: "Discount R$", icon: Percent, color: "#f59e0b" },
  bundle:           { label: "Bundle",      icon: Gift,    color: "#8b5cf6" },
  bonus_points:     { label: "Bonus pts",   icon: Sparkles, color: "#06b6d4" },
  free_shipping:    { label: "Free ship",   icon: Truck,   color: "#22c55e" },
  voucher:          { label: "Voucher",     icon: Tag,     color: "#ec4899" },
};

function TypeBadge({ type }) {
  const meta = OFFER_TYPE_META[type] ?? { label: type, icon: Tag, color: "#adb5bd" };
  const Icon = meta.icon;
  return (
    <span className="status-pill" style={{ background: meta.color + "22", color: meta.color, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
      <Icon size={11} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

export default function OffersPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const successTimer = useRef(null);

  function load() {
    setLoading(true);
    api.listOffers()
      .then((r) => setOffers(r.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function showSuccess(msg) {
    clearTimeout(successTimer.current);
    setSuccess(msg);
    successTimer.current = setTimeout(() => setSuccess(null), 4000);
  }

  async function handleArchive(offer) {
    if (!window.confirm(`Archive offer "${offer.title}"?`)) return;
    try {
      await api.archiveOffer(offer.id);
      showSuccess(`"${offer.title}" archived.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleRestore(offer) {
    try {
      await api.updateOffer(offer.id, { status: "active" });
      showSuccess(`"${offer.title}" restored.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const columns = [
    {
      key: "title",
      header: "Offer",
      render: (o) => (
        <div>
          <Link to={`/personalization/offers/${o.id}`} className="table-link">{o.title}</Link>
          {o.description && (
            <div style={{ fontSize: "0.8rem", color: "var(--coxa-text-muted)", marginTop: "0.15rem" }}>
              {o.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (o) => <TypeBadge type={o.offerType} />,
    },
    {
      key: "value",
      header: "Value",
      render: (o) => {
        if (o.offerType === "discount_percent") return `${o.value}%`;
        if (o.offerType === "bonus_points") return `${o.value} pts`;
        if (o.offerType === "discount_fixed" || o.offerType === "free_shipping") {
          return `R$${(o.value / 100).toFixed(2)}`;
        }
        return o.value ?? "—";
      },
    },
    {
      key: "segment",
      header: "Segment",
      render: (o) =>
        o.segmentName ? (
          <span className="badge badge--purple">{o.segmentName}</span>
        ) : (
          <span className="badge badge--gray">All fans (fallback)</span>
        ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (o) => o.priority ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <span className={`status-pill event-status--${o.status === "active" ? "sale" : o.status === "draft" ? "draft" : "cancelled"}`}>
          {o.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (o) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <Link to={`/personalization/offers/${o.id}`} className="btn btn--ghost btn--sm">
            Edit
          </Link>
          {o.status !== "archived" ? (
            <button type="button" className="btn btn--ghost btn--sm" style={{ color: "var(--coxa-danger, #ef4444)" }} onClick={() => handleArchive(o)}>
              Archive
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleRestore(o)}>
              Restore
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        module="Personalization"
        title="Offers"
        description="Manage the offer catalog used by the Next Best Offer engine."
        actions={
          <Link to="/personalization/offers/new" className="btn btn--primary">
            New offer
          </Link>
        }
      />

      {error && (
        <div className="alert error" style={{ marginBottom: "1rem" }}>
          {error}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setError(null)} style={{ marginLeft: "1rem" }}>Dismiss</button>
        </div>
      )}
      {success && <div className="alert success" style={{ marginBottom: "1rem" }}>{success}</div>}

      <div className="panel-card">
        <div className="panel-card__body">
          {loading ? (
            <p style={{ padding: "1rem" }}>Loading…</p>
          ) : (
            <DataTable
              columns={columns}
              data={offers}
              rowKey="id"
              emptyMessage="No offers yet. Create your first offer."
              pagination={offers.length > 20}
            />
          )}
        </div>
      </div>
    </div>
  );
}
