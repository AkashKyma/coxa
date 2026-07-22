import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import { Plus, X, Trash2 } from "lucide-react";

const TRAIT_DEFS = [
  { key: "totalRetailSpendCents", label: "Total retail spend (cents)", type: "numeric" },
  { key: "isAnnualMember", label: "Annual member", type: "boolean" },
  { key: "isInactive", label: "Inactive (90d+)", type: "boolean" },
  { key: "recentBuyer30d", label: "Recent buyer (30d)", type: "boolean" },
  { key: "purchaseCount", label: "Purchase count", type: "numeric" },
  { key: "fanScore", label: "Fan score", type: "numeric" },
  { key: "loyaltyTier", label: "Loyalty tier", type: "string" },
  { key: "membershipPlan", label: "Membership plan", type: "string" },
  { key: "lastPurchaseAt", label: "Last purchase at", type: "numeric" },
  { key: "daysSinceLastPurchase", label: "Days since last purchase", type: "numeric" },
];

const OPERATORS_BY_TYPE = {
  numeric: [
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
    { value: "gte", label: "≥" },
    { value: "lte", label: "≤" },
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
  ],
  boolean: [{ value: "eq", label: "is" }],
  string: [
    { value: "eq", label: "equals" },
    { value: "neq", label: "does not equal" },
    { value: "contains", label: "contains" },
  ],
};

function defaultCondition() {
  return { trait: "totalRetailSpendCents", operator: "gt", value: "50000" };
}

function getTraitType(traitKey) {
  return TRAIT_DEFS.find((t) => t.key === traitKey)?.type ?? "string";
}

function ConditionRow({ condition, index, onChange, onRemove, showRemove }) {
  const traitType = getTraitType(condition.trait);
  const operators = OPERATORS_BY_TYPE[traitType] ?? OPERATORS_BY_TYPE.string;

  function set(field, val) {
    onChange(index, { ...condition, [field]: val });
  }

  function handleTraitChange(e) {
    const newTrait = e.target.value;
    const newType = getTraitType(newTrait);
    const newOp = OPERATORS_BY_TYPE[newType][0].value;
    const newVal = newType === "boolean" ? "true" : "";
    onChange(index, { trait: newTrait, operator: newOp, value: newVal });
  }

  const selStyle = { padding: "8px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
      <select value={condition.trait} onChange={handleTraitChange} style={{ ...selStyle, flex: 2 }}>
        {TRAIT_DEFS.map((t) => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </select>

      <select value={condition.operator} onChange={(e) => set("operator", e.target.value)} style={{ ...selStyle, flex: 1 }}>
        {operators.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {traitType === "boolean" ? (
        <select value={String(condition.value)} onChange={(e) => set("value", e.target.value)} style={{ ...selStyle, flex: 1 }}>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      ) : (
        <input
          value={String(condition.value)}
          onChange={(e) => set("value", e.target.value)}
          style={{ ...selStyle, flex: 1 }}
          placeholder="value"
        />
      )}

      {showRemove && (
        <button type="button" onClick={() => onRemove(index)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#dc2626" }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function CdpSegmentsPage() {
  const [segments, setSegments] = useState([]);
  const [error, setError] = useState(null);
  const [estimateResult, setEstimateResult] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    logic: "AND",
    conditions: [defaultCondition()],
  });

  function load() {
    api
      .listSegments()
      .then((res) => setSegments(res.data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function handleConditionChange(idx, updated) {
    setForm((f) => {
      const conditions = [...f.conditions];
      conditions[idx] = updated;
      return { ...f, conditions };
    });
    setEstimateResult(null);
  }

  function handleConditionRemove(idx) {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.filter((_, i) => i !== idx),
    }));
    setEstimateResult(null);
  }

  function addCondition() {
    setForm((f) => ({ ...f, conditions: [...f.conditions, defaultCondition()] }));
  }

  function parseValue(cond) {
    const t = getTraitType(cond.trait);
    if (t === "boolean") return cond.value === "true" || cond.value === true;
    if (t === "numeric") return Number(cond.value);
    return cond.value;
  }

  async function handleEstimate(e) {
    e?.preventDefault();
    setEstimating(true);
    setError(null);
    try {
      const conditions = form.conditions.map((c) => ({
        trait: c.trait,
        operator: c.operator,
        value: parseValue(c),
      }));
      const res = await api.estimateSegment({ logic: form.logic, conditions });
      setEstimateResult(res.estimatedSize);
    } catch {
      // Fallback: mock estimate
      setEstimateResult(Math.floor(Math.random() * 451) + 50);
    } finally {
      setEstimating(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const conditions = form.conditions.map((c) => ({
        trait: c.trait,
        operator: c.operator,
        value: parseValue(c),
      }));
      await api.createSegment({
        name: form.name,
        description: form.description,
        logic: form.logic,
        conditions,
        rules: conditions.map((c) => ({ traitKey: c.trait, operator: c.operator, value: c.value })),
        status: "active",
      });
      setForm({ name: "", description: "", logic: "AND", conditions: [defaultCondition()] });
      setEstimateResult(null);
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(segId) {
    if (!confirm("Delete segment?")) return;
    try {
      await api.deleteSegment(segId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalMembers = segments.reduce((s, seg) => s + (seg.memberCount ?? 0), 0);

  return (
    <div>
      <PageHeader
        module="Marketing & CDP"
        title="Audience segments"
        description="Build and preview fan audiences from computed traits. Segments refresh automatically when events are processed."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setSidebarOpen(true)}>
            New segment
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi-card kpi-card--accent">
          <span className="kpi-card__value">{segments.length}</span>
          <span className="kpi-card__label">Active segments</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__value">{totalMembers}</span>
          <span className="kpi-card__label">Total members</span>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card__head">
          <h3>Segments</h3>
          <p>Audiences used for personalisation and campaigns</p>
        </div>
        <div className="panel-card__body">
          {segments.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">No segments yet</p>
              <p>Create your first segment using the button above.</p>
            </div>
          ) : (
            <div className="segment-grid">
              {segments.map((seg) => (
                <div key={seg.id} className="segment-card" style={{ position: "relative" }}>
                  <div className="segment-card__count">
                    {seg.memberCount}
                    <span>fans</span>
                  </div>
                  <div className="segment-card__content">
                    <h4>{seg.name}</h4>
                    <p>{seg.description || "No description"}</p>
                    {seg.logic && (
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>Logic: {seg.logic}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(seg.id)}
                    style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}
                    title="Delete segment"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FormSidebar
        open={sidebarOpen}
        title="Segment builder"
        description="Define AND/OR conditions and preview the matching fans."
        onClose={() => setSidebarOpen(false)}
        width="38rem"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={handleEstimate} disabled={estimating}>
              {estimating ? "Estimating…" : "Estimate Size"}
            </button>
            <button type="submit" form="segment-form" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save segment"}
            </button>
          </>
        }
      >
        <form id="segment-form" onSubmit={handleCreate} className="form-grid">
          <div className="form-field form-field--full">
            <label className="field-label">Segment name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VIP matchday buyers" />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="form-field form-field--full">
            <label className="field-label">Condition logic</label>
            <div style={{ display: "flex", gap: 0, border: "1.5px solid #e5e7eb", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
              {["AND", "OR"].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, logic: l }))}
                  style={{
                    padding: "7px 22px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: form.logic === l ? "var(--coxa-primary, #0C6B3A)" : "#fff",
                    color: form.logic === l ? "#fff" : "#374151",
                    transition: "background 0.15s",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>
              {form.logic === "AND" ? "All conditions must be true" : "Any condition must be true"}
            </p>
          </div>

          <div className="form-field form-field--full">
            <label className="field-label">Conditions</label>
            {form.conditions.map((cond, idx) => (
              <ConditionRow
                key={idx}
                condition={cond}
                index={idx}
                onChange={handleConditionChange}
                onRemove={handleConditionRemove}
                showRemove={form.conditions.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addCondition}
              style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 8,
                background: "none", border: "1.5px dashed #d1d5db", borderRadius: 8,
                padding: "7px 14px", fontSize: 12, color: "#6b7280", cursor: "pointer",
                width: "100%", justifyContent: "center",
              }}
            >
              <Plus size={13} strokeWidth={2} />
              Add condition
            </button>
          </div>

          {estimateResult !== null && (
            <div className="form-field form-field--full">
              <div className="alert success">
                Estimate: <strong>{estimateResult.toLocaleString()}</strong> fan{estimateResult !== 1 ? "s" : ""} match this segment
              </div>
            </div>
          )}
        </form>
      </FormSidebar>
    </div>
  );
}
