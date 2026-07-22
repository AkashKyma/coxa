/**
 * TagPicker — UI component for applying/removing labels on an entity.
 * Uses the /api/v1/labels endpoints.
 *
 * Props:
 *   entityType  – 'fan' | 'product' | 'sale' | 'ticket' | ...
 *   entityId    – MongoDB ObjectId string
 *   labels      – array of available Label objects
 *   selected    – array of currently applied Label objects
 *   onChange    – (updatedLabels) => void
 *   disabled    – boolean
 */
import { useState } from "react";
import { X, Tag, ChevronDown } from "lucide-react";

export default function TagPicker({ entityType, entityId, labels = [], selected = [], onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIds = new Set(selected.map((l) => String(l._id ?? l.id)));
  const filtered = labels.filter(
    (l) => !selectedIds.has(String(l._id ?? l.id)) && l.name.toLowerCase().includes(search.toLowerCase())
  );

  async function applyLabel(label) {
    const next = [...selected, label];
    onChange?.(next);
    setOpen(false);
    setSearch("");
    if (entityId) {
      await fetch(`/api/v1/labels/entity/${entityType}/${entityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelIds: [label._id ?? label.id] }),
      }).catch(() => {});
    }
  }

  async function removeLabel(label) {
    const next = selected.filter((l) => String(l._id ?? l.id) !== String(label._id ?? label.id));
    onChange?.(next);
    if (entityId) {
      await fetch(`/api/v1/labels/entity/${entityType}/${entityId}/${label._id ?? label.id}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {selected.map((label) => (
          <span
            key={label._id ?? label.id}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
              background: label.color ?? "#16a34a", color: "#fff", borderRadius: 999,
              fontSize: 12, fontWeight: 500,
            }}
          >
            {label.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeLabel(label)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#fff", display: "flex" }}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
              background: "#f3f4f6", border: "1px dashed #d1d5db", borderRadius: 999,
              fontSize: 12, cursor: "pointer", color: "#374151",
            }}
          >
            <Tag size={12} />
            Add label
            <ChevronDown size={12} />
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", zIndex: 100, top: "100%", left: 0, marginTop: 4,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,.1)",
          minWidth: 220, maxHeight: 280, overflow: "auto",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search labels…"
              style={{ width: "100%", border: "none", outline: "none", fontSize: 13 }}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 13 }}>No labels found</div>
          ) : (
            filtered.map((label) => (
              <button
                key={label._id ?? label.id}
                type="button"
                onClick={() => applyLabel(label)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "6px 12px", background: "none", border: "none", cursor: "pointer",
                  textAlign: "left", fontSize: 13, color: "#111",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: label.color ?? "#16a34a", flexShrink: 0 }} />
                {label.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
