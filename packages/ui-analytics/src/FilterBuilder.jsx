import { useState } from "react";
import { X } from "lucide-react";

const OPERATORS = {
  string: ["eq", "neq", "contains", "exists", "in"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "exists"],
  boolean: ["eq", "exists"],
  enum: ["eq", "neq", "in"],
  date: ["gt", "gte", "lt", "lte"],
};

const OP_LABELS = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  exists: "exists",
  in: "is one of",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

function emptyRule() {
  return { id: crypto.randomUUID(), field: "", operator: "eq", value: "" };
}

/**
 * FilterBuilder — visual rule editor replacing raw JSON textarea.
 *
 * Props:
 *   fields    – [{ field, label, type, operators?, valueSource }]
 *   value     – [{ field, operator, value }]
 *   onChange  – fn(rules[])
 *   onPreview – fn()
 *   previewCount – number|null
 *   loading   – boolean
 */
export default function FilterBuilder({
  fields = [],
  value = [],
  onChange,
  onPreview,
  previewCount,
  loading = false,
}) {
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  const rules = value.length ? value.map((r, i) => ({ ...r, id: r.id ?? i })) : [emptyRule()];

  function updateRule(id, patch) {
    const next = rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
    onChange?.(next.map(({ id: _id, ...rest }) => rest));
  }

  function addRule() {
    onChange?.([...rules.map(({ id: _id, ...rest }) => rest), emptyRule()].map(({ id: _id, ...rest }) => rest));
  }

  function removeRule(id) {
    const next = rules.filter((r) => r.id !== id);
    onChange?.(next.map(({ id: _id, ...rest }) => rest));
  }

  function getOps(fieldKey) {
    const f = fields.find((x) => x.field === fieldKey);
    if (!f) return OPERATORS.string;
    return f.operators ?? OPERATORS[f.type] ?? OPERATORS.string;
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("Expected array");
      setJsonError("");
      onChange?.(parsed);
      setShowJson(false);
    } catch (e) {
      setJsonError(e.message);
    }
  }

  return (
    <div className="filter-builder">
      <div className="filter-builder__toolbar">
        <span className="filter-builder__conjunction">ALL of</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => {
          setJsonText(JSON.stringify(rules.map(({ id: _id, ...r }) => r), null, 2));
          setShowJson(!showJson);
        }}>
          {showJson ? "Visual editor" : "Advanced JSON"}
        </button>
      </div>

      {showJson ? (
        <div className="filter-builder__json">
          <textarea
            className="input filter-builder__json-area"
            rows={10}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {jsonError && <p className="filter-builder__error">{jsonError}</p>}
          <button type="button" className="btn btn--primary btn--sm" onClick={applyJson}>Apply JSON</button>
        </div>
      ) : (
        <div className="filter-builder__rules">
          {rules.map((rule, idx) => {
            const ops = getOps(rule.field);
            const fieldDef = fields.find((f) => f.field === rule.field);
            return (
              <div key={rule.id ?? idx} className="filter-builder__rule">
                {idx > 0 && <span className="filter-builder__and">AND</span>}
                <select
                  className="input input--sm"
                  value={rule.field}
                  onChange={(e) => updateRule(rule.id, { field: e.target.value, operator: "eq", value: "" })}
                >
                  <option value="">— field —</option>
                  {fields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                </select>
                <select
                  className="input input--sm"
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value })}
                >
                  {ops.map((op) => <option key={op} value={op}>{OP_LABELS[op] ?? op}</option>)}
                </select>
                {rule.operator !== "exists" && (
                  fieldDef?.valueSource?.options ? (
                    <select
                      className="input input--sm"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    >
                      <option value="">— value —</option>
                      {fieldDef.valueSource.options.map((o) => (
                        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input input--sm"
                      placeholder="value…"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    />
                  )
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--xs btn--danger"
                  onClick={() => removeRule(rule.id)}
                  disabled={rules.length === 1}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, padding: 0 }}
                ><X size={13} strokeWidth={2.5} /></button>
              </div>
            );
          })}
          <button type="button" className="btn btn--ghost btn--sm" onClick={addRule}>+ Add rule</button>
        </div>
      )}

      <div className="filter-builder__actions">
        <button type="button" className="btn btn--ghost" onClick={onPreview} disabled={loading}>
          {loading ? "Loading…" : "Preview"}
          {previewCount != null && !loading && (
            <span className="filter-builder__count"> ({previewCount.toLocaleString()} fans)</span>
          )}
        </button>
      </div>
    </div>
  );
}
