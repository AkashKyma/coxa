import { useEffect, useState } from "react";
import { api, formatBrl } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";

const SEAT_TYPES = [
  { value: "none", label: "No seat" },
  { value: "general", label: "General admission" },
  { value: "assigned", label: "Assigned seat" },
  { value: "vip", label: "VIP" },
];

const EMPTY_PLAN = {
  id: "",
  planCode: "",
  name: "",
  tierLevel: 1,
  description: "",
  benefits: "",
  monthlyPriceCents: 0,
  annualPriceCents: 0,
  seatType: "general",
  sectorCode: "",
  priorityBase: 100,
  priorityOrder: 100,
  status: "active",
};

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .listMembershipPlans()
      .then((res) => setPlans(res.data ?? []))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function openCreate() {
    setForm(EMPTY_PLAN);
    setSidebarOpen(true);
  }

  function openEdit(plan) {
    setForm({
      id: plan.id,
      planCode: plan.planCode,
      name: plan.name,
      tierLevel: plan.tierLevel ?? 1,
      description: plan.description ?? "",
      benefits: (plan.benefits ?? []).join("\n"),
      monthlyPriceCents: plan.monthlyPriceCents ?? 0,
      annualPriceCents: plan.annualPriceCents ?? 0,
      seatType: plan.seatType ?? "general",
      sectorCode: plan.sectorCode ?? "",
      priorityBase: plan.priorityBase ?? 100,
      priorityOrder: plan.priorityOrder ?? 100,
      status: plan.status ?? "active",
    });
    setSidebarOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        planCode: form.planCode.trim(),
        name: form.name.trim(),
        tierLevel: Number(form.tierLevel),
        description: form.description || undefined,
        benefits: form.benefits
          ? form.benefits.split("\n").map((b) => b.trim()).filter(Boolean)
          : [],
        monthlyPriceCents: Number(form.monthlyPriceCents) || 0,
        annualPriceCents: Number(form.annualPriceCents) || 0,
        seatType: form.seatType,
        sectorCode: form.sectorCode || undefined,
        priorityBase: Number(form.priorityBase) || 100,
        priorityOrder: Number(form.priorityOrder) || 100,
        status: form.status,
      };
      await api.createMembershipPlan(body);
      setSuccess(`Plan "${form.name}" saved.`);
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        module="Membership"
        title="Membership plans"
        description="Define Sócio Coxa tiers — pricing, seat allocation and loyalty priority base."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Add plan
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}
      {success && (
        <div className="alert success">
          {success}{" "}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSuccess(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="cards" style={{ marginTop: "1.5rem" }}>
        {plans.length === 0 && (
          <div className="empty-state">
            <p className="empty-state__title">No plans yet</p>
            <p className="empty-state__desc">Create your first Sócio Coxa membership tier.</p>
          </div>
        )}
        {plans.map((plan) => (
          <article key={plan.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span className="status-pill event-status--published">{plan.planCode}</span>
                <h3 style={{ marginTop: "0.5rem" }}>{plan.name}</h3>
              </div>
              <span className={`status-pill event-status--${plan.status === "active" ? "sale" : "draft"}`}>
                {plan.status}
              </span>
            </div>
            {plan.description && <p className="panel__desc">{plan.description}</p>}
            <div className="plan-meta" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
              <div><strong>Monthly:</strong> {formatBrl(plan.monthlyPriceCents)}</div>
              <div><strong>Annual:</strong> {plan.annualPriceCents > 0 ? formatBrl(plan.annualPriceCents) : "—"}</div>
              <div><strong>Tier level:</strong> {plan.tierLevel}</div>
              <div><strong>Seat type:</strong> {plan.seatType}</div>
              {plan.sectorCode && <div><strong>Sector:</strong> {plan.sectorCode}</div>}
              <div><strong>Priority base:</strong> {plan.priorityBase}</div>
            </div>
            {plan.benefits?.length > 0 && (
              <ul className="benefits-list" style={{ marginTop: "0.75rem" }}>
                {plan.benefits.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginTop: "1rem" }}
              onClick={() => openEdit(plan)}
            >
              Edit
            </button>
          </article>
        ))}
      </div>

      <FormSidebar
        open={sidebarOpen}
        title={form.id ? "Edit plan" : "New membership plan"}
        onClose={() => setSidebarOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSidebarOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="plan-form" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save plan"}
            </button>
          </>
        }
      >
        <form id="plan-form" onSubmit={handleSave} className="form-grid">
          <div className="form-field">
            <label className="field-label">Plan code *</label>
            <input required value={form.planCode} onChange={set("planCode")} placeholder="SOCIO-OURO" disabled={Boolean(form.id)} />
          </div>
          <div className="form-field">
            <label className="field-label">Tier level</label>
            <input type="number" min="1" required value={form.tierLevel} onChange={set("tierLevel")} />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Name *</label>
            <input required value={form.name} onChange={set("name")} />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Description</label>
            <input value={form.description} onChange={set("description")} />
          </div>
          <div className="form-field">
            <label className="field-label">Monthly price (centavos)</label>
            <input type="number" min="0" value={form.monthlyPriceCents} onChange={set("monthlyPriceCents")} />
          </div>
          <div className="form-field">
            <label className="field-label">Annual price (centavos)</label>
            <input type="number" min="0" value={form.annualPriceCents} onChange={set("annualPriceCents")} />
          </div>
          <div className="form-field">
            <label className="field-label">Seat type</label>
            <select value={form.seatType} onChange={set("seatType")}>
              {SEAT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="field-label">Sector code</label>
            <input value={form.sectorCode} onChange={set("sectorCode")} placeholder="SUL-A" />
          </div>
          <div className="form-field">
            <label className="field-label">Priority base (score bonus)</label>
            <input type="number" min="0" value={form.priorityBase} onChange={set("priorityBase")} />
          </div>
          <div className="form-field">
            <label className="field-label">Priority order (sort)</label>
            <input type="number" min="1" value={form.priorityOrder} onChange={set("priorityOrder")} />
          </div>
          <div className="form-field">
            <label className="field-label">Status</label>
            <select value={form.status} onChange={set("status")}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Benefits (one per line)</label>
            <textarea
              rows={4}
              value={form.benefits}
              onChange={set("benefits")}
              placeholder={"Priority ticket access\nExclusive locker tour\nMember-only events"}
              style={{ resize: "vertical" }}
            />
          </div>
        </form>
      </FormSidebar>
    </div>
  );
}
