import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";

const OFFER_TYPES = [
  { value: "discount_percent", label: "Discount %" },
  { value: "discount_fixed",   label: "Discount R$ (fixed)" },
  { value: "bundle",           label: "Bundle" },
  { value: "bonus_points",     label: "Bonus points" },
  { value: "free_shipping",    label: "Free shipping" },
  { value: "voucher",          label: "Voucher" },
];

const VALUE_HINT = {
  discount_percent: "e.g. 10 → 10% off",
  discount_fixed:   "in centavos, e.g. 1500 → R$15.00",
  bundle:           "discount % applied to bundle",
  bonus_points:     "number of bonus points",
  free_shipping:    "minimum order in centavos to qualify",
  voucher:          "number of vouchers / arbitrary value",
};

const EMPTY = {
  title: "",
  description: "",
  offerType: "discount_percent",
  value: "",
  productHint: "",
  segmentId: "",
  minPoints: "0",
  priority: "100",
  status: "active",
  validFrom: "",
  validUntil: "",
};

export default function OfferFormPage() {
  const { id } = useParams(); // "new" or an offer id
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [segments, setSegments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listSegments()
      .then((r) => setSegments(r.data?.segments ?? r.data ?? []))
      .catch(() => {});

    if (!isNew) {
      api.listOffers()
        .then((r) => {
          const offer = (r.data ?? []).find((o) => o.id === id);
          if (!offer) return;
          setForm({
            title: offer.title ?? "",
            description: offer.description ?? "",
            offerType: offer.offerType ?? "discount_percent",
            value: offer.value ?? "",
            productHint: offer.productHint ?? "",
            segmentId: offer.segmentId?._id ?? offer.segmentId ?? "",
            minPoints: offer.minPoints ?? "0",
            priority: offer.priority ?? "100",
            status: offer.status ?? "active",
            validFrom: offer.validFrom ? offer.validFrom.slice(0, 10) : "",
            validUntil: offer.validUntil ? offer.validUntil.slice(0, 10) : "",
          });
        })
        .catch((e) => setError(e.message));
    }
  }, [id, isNew]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        offerType: form.offerType,
        value: form.value !== "" ? Number(form.value) : 0,
        productHint: form.productHint.trim() || undefined,
        segmentId: form.segmentId || null,
        minPoints: Number(form.minPoints) || 0,
        priority: Number(form.priority) || 100,
        status: form.status,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };

      if (isNew) {
        await api.createOffer(body);
      } else {
        await api.updateOffer(id, body);
      }
      navigate("/personalization/offers");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        module="Personalization"
        title={isNew ? "New offer" : "Edit offer"}
        description={isNew ? "Add a new offer to the NBO catalog." : "Update this offer's details."}
        actions={
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/personalization/offers")}>
            ← Back to offers
          </button>
        }
      />

      {error && (
        <div className="alert error" style={{ marginBottom: "1rem" }}>
          {error}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setError(null)} style={{ marginLeft: "1rem" }}>Dismiss</button>
        </div>
      )}

      <div className="panel-card" style={{ maxWidth: "720px" }}>
        <div className="panel-card__body">
          <form id="offer-form" onSubmit={handleSubmit} className="form-grid">

            <div className="form-field form-field--full">
              <label className="field-label">Title *</label>
              <input required value={form.title} onChange={set("title")} placeholder="10% off Home Jersey" />
            </div>

            <div className="form-field form-field--full">
              <label className="field-label">Description</label>
              <input value={form.description} onChange={set("description")} placeholder="Short description shown to fans" />
            </div>

            <div className="form-field">
              <label className="field-label">Offer type *</label>
              <select required value={form.offerType} onChange={set("offerType")}>
                {OFFER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">
                Value
                <span style={{ fontWeight: 400, color: "var(--coxa-text-muted)", marginLeft: "0.4rem", fontSize: "0.8rem" }}>
                  {VALUE_HINT[form.offerType]}
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.value}
                onChange={set("value")}
                placeholder="0"
              />
            </div>

            <div className="form-field form-field--full">
              <label className="field-label">Product hint</label>
              <input value={form.productHint} onChange={set("productHint")} placeholder="e.g. Home Jersey 2026" />
            </div>

            <div className="form-field form-field--full">
              <label className="field-label">Target segment</label>
              <select value={form.segmentId} onChange={set("segmentId")}>
                <option value="">All fans (fallback / no segment)</option>
                {segments.map((s) => (
                  <option key={s._id ?? s.id} value={s._id ?? s.id}>{s.name}</option>
                ))}
              </select>
              <p className="field-hint" style={{ fontSize: "0.8rem", color: "var(--coxa-text-muted)", marginTop: "0.25rem" }}>
                Leave blank to make this the default fallback offer.
              </p>
            </div>

            <div className="form-field">
              <label className="field-label">Min loyalty points required</label>
              <input type="number" min="0" value={form.minPoints} onChange={set("minPoints")} />
            </div>

            <div className="form-field">
              <label className="field-label">Priority</label>
              <input type="number" min="1" value={form.priority} onChange={set("priority")} />
              <p className="field-hint" style={{ fontSize: "0.8rem", color: "var(--coxa-text-muted)", marginTop: "0.25rem" }}>
                Lower = evaluated first. Fallback offers should have high values (e.g. 999).
              </p>
            </div>

            <div className="form-field">
              <label className="field-label">Valid from</label>
              <input type="date" value={form.validFrom} onChange={set("validFrom")} />
            </div>

            <div className="form-field">
              <label className="field-label">Valid until</label>
              <input type="date" value={form.validUntil} onChange={set("validUntil")} />
            </div>

            <div className="form-field">
              <label className="field-label">Status</label>
              <select value={form.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="form-field form-field--full" style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => navigate("/personalization/offers")}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? "Saving…" : isNew ? "Create offer" : "Save changes"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
