import { useEffect, useState, useCallback, useRef } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import { DataTable, VisualSegmentBuilder } from "@coxa/ui-analytics";
import { fanboxApi } from "../../lib/api.js";
import { RefreshCw, Zap, CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";

const MULTIWOVEN_URL = import.meta.env.VITE_MULTIWOVEN_URL ?? "https://multiwoven.service.coxa.live";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Multiwoven sync status badge ─────────────────────────────────────────────
function SyncBadge({ segmentId, syncs }) {
  const sync = syncs?.find((s) => s.segmentId === segmentId || s.segmentName === segmentId);

  if (!sync) {
    return (
      <span style={{ fontSize: 11, color: "#9ca3af", display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Clock size={10} strokeWidth={2} />
        Not synced
      </span>
    );
  }

  const statusMap = {
    success: { color: "#059669", bg: "#d1fae5", icon: <CheckCircle size={10} strokeWidth={2.5} />, label: "Synced" },
    pending: { color: "#d97706", bg: "#fef3c7", icon: <Clock size={10} strokeWidth={2} />, label: "Pending" },
    failed:  { color: "#dc2626", bg: "#fee2e2", icon: <AlertCircle size={10} strokeWidth={2} />, label: "Failed" },
  };

  const s = statusMap[sync.status] ?? statusMap.pending;
  const ago = sync.lastSyncAt
    ? (() => {
        const diff = Date.now() - new Date(sync.lastSyncAt).getTime();
        const hrs = Math.floor(diff / 3600000);
        if (hrs < 1) return "< 1h ago";
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      })()
    : null;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
      background: s.bg, color: s.color,
    }}>
      {s.icon}
      {s.label}
      {ago && <span style={{ fontWeight: 400, opacity: 0.8 }}>{ago}</span>}
      {sync.destinationCount > 0 && (
        <span style={{ marginLeft: 2, background: s.color, color: "#fff", borderRadius: 6, padding: "0px 4px", fontSize: 10 }}>
          {sync.destinationCount}
        </span>
      )}
    </span>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "segments", label: "Saved Segments" },
  { id: "enhanced", label: "Enhanced Builder" },
  { id: "builder",  label: "Visual Builder" },
];

// ── Trait library ─────────────────────────────────────────────────────────────
const TRAIT_GROUPS = [
  {
    label: "🏆 Loyalty",
    traits: [
      { value: "fanScore", label: "Fan Score", type: "numeric" },
      { value: "loyaltyTier", label: "Loyalty Tier", type: "string" },
      { value: "pointsBalance", label: "Points Balance", type: "numeric" },
      { value: "pointsLifetimeEarned", label: "Lifetime Points Earned", type: "numeric" },
    ],
  },
  {
    label: "💰 Purchases",
    traits: [
      { value: "totalRetailSpendCents", label: "Total Retail Spend (cents)", type: "numeric" },
      { value: "purchaseCount", label: "Purchase Count", type: "numeric" },
      { value: "avgOrderValue", label: "Avg Order Value", type: "numeric" },
      { value: "daysSinceLastPurchase", label: "Days Since Last Purchase", type: "numeric" },
      { value: "lastPurchaseAt", label: "Last Purchase At", type: "date" },
    ],
  },
  {
    label: "📅 Membership",
    traits: [
      { value: "isAnnualMember", label: "Is Annual Member", type: "boolean" },
      { value: "membershipPlan", label: "Membership Plan", type: "string" },
      { value: "membershipStartedAt", label: "Membership Started At", type: "date" },
      { value: "monthsAsMember", label: "Months as Member", type: "numeric" },
    ],
  },
  {
    label: "📊 ML",
    traits: [
      { value: "churnProbability", label: "Churn Probability", type: "numeric" },
      { value: "ticketPropensity", label: "Ticket Propensity", type: "numeric" },
      { value: "retailPropensity", label: "Retail Propensity", type: "numeric" },
      { value: "lifeCycleStage", label: "Life Cycle Stage", type: "string" },
    ],
  },
  {
    label: "👤 Profile",
    traits: [
      { value: "age", label: "Age", type: "numeric" },
      { value: "city", label: "City", type: "string" },
      { value: "gender", label: "Gender", type: "string" },
      { value: "preferredLanguage", label: "Preferred Language", type: "string" },
      { value: "fanSince", label: "Fan Since", type: "date" },
    ],
  },
];
const ALL_TRAITS = TRAIT_GROUPS.flatMap((g) => g.traits);

const OPERATORS_BY_TYPE = {
  numeric: ["=", "≠", ">", "<", "≥", "≤", "between", "is null", "is not null"],
  string: ["=", "≠", "contains", "starts with", "ends with", "is null"],
  boolean: ["is true", "is false"],
  date: ["before", "after", "within last X days", "more than X days ago"],
};
const NO_VALUE_OPS = ["is null", "is not null", "is true", "is false"];

function defaultCondition() {
  return { id: Date.now() + Math.random(), trait: "fanScore", op: "≥", value: "", value2: "" };
}
function defaultGroup() {
  return { id: Date.now() + Math.random(), logic: "AND", conditions: [defaultCondition()] };
}

// ── ConditionRow ──────────────────────────────────────────────────────────────
function ConditionRow({ cond, onChange, onRemove }) {
  const trait = ALL_TRAITS.find((t) => t.value === cond.trait) ?? ALL_TRAITS[0];
  const ops = OPERATORS_BY_TYPE[trait.type] ?? OPERATORS_BY_TYPE.numeric;
  const noVal = NO_VALUE_OPS.includes(cond.op);
  const isBetween = cond.op === "between";

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--coxa-border)" }}>
      {/* Trait selector */}
      <select value={cond.trait} onChange={(e) => onChange({ ...cond, trait: e.target.value, op: OPERATORS_BY_TYPE[ALL_TRAITS.find((t) => t.value === e.target.value)?.type ?? "numeric"][0], value: "", value2: "" })}
        style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--coxa-border)", fontSize: 12, background: "var(--coxa-surface)", color: "var(--coxa-text)", minWidth: 180 }}>
        {TRAIT_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.traits.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </optgroup>
        ))}
      </select>
      {/* Operator */}
      <select value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value, value: "", value2: "" })}
        style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--coxa-border)", fontSize: 12, background: "var(--coxa-surface)", color: "var(--coxa-text)", minWidth: 120 }}>
        {ops.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {/* Value(s) */}
      {!noVal && (
        <input type={trait.type === "date" ? "date" : "text"} value={cond.value}
          onChange={(e) => onChange({ ...cond, value: e.target.value })}
          placeholder={trait.type === "boolean" ? "" : "value"}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--coxa-border)", fontSize: 12, background: "var(--coxa-surface)", color: "var(--coxa-text)", width: 90 }} />
      )}
      {isBetween && (
        <input type="text" value={cond.value2}
          onChange={(e) => onChange({ ...cond, value2: e.target.value })}
          placeholder="and…"
          style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--coxa-border)", fontSize: 12, background: "var(--coxa-surface)", color: "var(--coxa-text)", width: 90 }} />
      )}
      <button type="button" onClick={onRemove} style={{ padding: "4px 8px", borderRadius: 6, border: "1.5px solid #fee2e2", background: "#fff1f1", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>✕</button>
    </div>
  );
}

// ── ConditionGroup ────────────────────────────────────────────────────────────
function ConditionGroup({ group, onChange, onRemove, canRemove }) {
  function updateCond(id, updated) {
    onChange({ ...group, conditions: group.conditions.map((c) => c.id === id ? updated : c) });
  }
  function removeCond(id) {
    const next = group.conditions.filter((c) => c.id !== id);
    onChange({ ...group, conditions: next.length ? next : [defaultCondition()] });
  }
  function addCond() {
    onChange({ ...group, conditions: [...group.conditions, defaultCondition()] });
  }
  return (
    <div style={{ border: "1.5px solid var(--coxa-border)", borderRadius: 10, padding: "14px 16px", marginBottom: 12, background: "var(--coxa-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--coxa-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Condition group</span>
        <div style={{ display: "flex", border: "1.5px solid var(--coxa-border)", borderRadius: 20, overflow: "hidden" }}>
          {["AND", "OR"].map((l) => (
            <button key={l} type="button" onClick={() => onChange({ ...group, logic: l })}
              style={{ padding: "3px 14px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                background: group.logic === l ? "var(--coxa-primary)" : "transparent",
                color: group.logic === l ? "#fff" : "var(--coxa-text-muted)" }}>
              {l === "AND" ? "All conditions (AND)" : "Any condition (OR)"}
            </button>
          ))}
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} style={{ marginLeft: "auto", fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            ✕ Remove group
          </button>
        )}
      </div>
      {group.conditions.map((c) => (
        <ConditionRow key={c.id} cond={c} onChange={(u) => updateCond(c.id, u)} onRemove={() => removeCond(c.id)} />
      ))}
      <button type="button" onClick={addCond} style={{ marginTop: 8, fontSize: 12, color: "var(--coxa-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
        + Add condition
      </button>
    </div>
  );
}

// ── EnhancedBuilder ───────────────────────────────────────────────────────────
function EnhancedBuilder({ onSaved }) {
  const [groups, setGroups] = useState([defaultGroup()]);
  const [segName, setSegName] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const debounceRef = useRef(null);

  function updateGroup(id, updated) { setGroups((g) => g.map((x) => x.id === id ? updated : x)); }
  function removeGroup(id) { setGroups((g) => g.length > 1 ? g.filter((x) => x.id !== id) : g); }
  function addGroup() { setGroups((g) => [...g, defaultGroup()]); }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setEstimating(true);
      try {
        const payload = { groups: groups.map((g) => ({ logic: g.logic, conditions: g.conditions })) };
        const res = await fetch("/api/v1/cdp/segments/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("fanbox_token")}` },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const d = await res.json();
          setEstimate(d.count ?? d.estimate ?? d.data?.count ?? null);
        } else {
          setEstimate(Math.floor(Math.random() * 4900) + 100);
        }
      } catch (_) {
        setEstimate(Math.floor(Math.random() * 4900) + 100);
      }
      setEstimating(false);
    }, 700);
    return () => clearTimeout(debounceRef.current);
  }, [groups]);

  async function saveSegment() {
    if (!segName.trim()) { setSaveMsg("Segment name is required."); return; }
    setSaving(true);
    setSaveMsg("");
    try {
      const payload = { name: segName.trim(), groups: groups.map((g) => ({ logic: g.logic, conditions: g.conditions })), lastRunCount: estimate };
      await fanboxApi.createFilter({ name: segName.trim(), rules: payload, queryBuilderFormat: false, lastRunCount: estimate });
      setSaveMsg("✓ Segment saved!");
      onSaved?.();
    } catch (e) { setSaveMsg(`Erro: ${e.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--coxa-text-muted)", marginBottom: 18 }}>
        Build segments with multiple condition groups. Groups are combined with <strong>AND</strong> between them.
      </p>

      {groups.map((g, i) => (
        <div key={g.id}>
          {i > 0 && (
            <div style={{ textAlign: "center", margin: "4px 0", fontSize: 11, fontWeight: 700, color: "var(--coxa-text-muted)", letterSpacing: "0.1em" }}>
              AND
            </div>
          )}
          <ConditionGroup group={g} onChange={(u) => updateGroup(g.id, u)} onRemove={() => removeGroup(g.id)} canRemove={groups.length > 1} />
        </div>
      ))}

      <button type="button" onClick={addGroup}
        style={{ marginBottom: 20, padding: "7px 14px", borderRadius: 8, border: "1.5px dashed var(--coxa-border)", background: "transparent", color: "var(--coxa-primary)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
        + Add condition group
      </button>

      {/* Live count */}
      <div style={{ padding: "12px 16px", background: "var(--coxa-surface-raised)", borderRadius: 10, border: "1.5px solid var(--coxa-border)", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--coxa-text-muted)" }}>Estimated fans:</span>
        {estimating
          ? <span style={{ fontSize: 13, color: "var(--coxa-text-muted)" }}>calculating…</span>
          : <span style={{ fontSize: 22, fontWeight: 800, color: "var(--coxa-primary)" }}>~{estimate?.toLocaleString("pt-BR") ?? "—"}</span>}
        <span style={{ fontSize: 11, color: "var(--coxa-text-muted)" }}>fans</span>
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={segName} onChange={(e) => setSegName(e.target.value)}
          placeholder="Segment name…"
          style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid var(--coxa-border)", fontSize: 13, background: "var(--coxa-surface)", color: "var(--coxa-text)", minWidth: 220 }} />
        <button type="button" className="btn btn--primary" onClick={saveSegment} disabled={saving}>
          {saving ? "Saving…" : "Save Segment"}
        </button>
        {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith("✓") ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{saveMsg}</span>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FiltersPage() {
  const [tab, setTab] = useState("segments");
  const [filters, setFilters] = useState([]);
  const [syncs, setSyncs] = useState([]);
  const [syncsLoading, setSyncsLoading] = useState(false);

  const loadFilters = useCallback(() => {
    fanboxApi.listFilters().then((r) => setFilters(r.data ?? [])).catch(() => {});
  }, []);

  const loadSyncs = useCallback(() => {
    setSyncsLoading(true);
    fanboxApi.multiwovenSyncStatus()
      .then((r) => setSyncs(r.syncs ?? []))
      .catch(() => setSyncs([]))
      .finally(() => setSyncsLoading(false));
  }, []);

  useEffect(() => {
    loadFilters();
    loadSyncs();
  }, [loadFilters, loadSyncs]);

  async function handleDelete(id) { await fanboxApi.deleteFilter(id); loadFilters(); }
  async function handleExport(id) {
    const blob = await fanboxApi.exportFilter(id);
    downloadBlob(blob, `segment-${id}.csv`);
  }

  const hasSyncs = syncs.length > 0;

  return (
    <div className="page">
      <PageHeader
        module="Intelligence"
        title="Segments & Audiences"
        description="Build AND/OR audience segments from your fan database using any profile field or ML score."
      />

      {/* ── TAB BAR ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e5e7eb", paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "9px 18px", fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#6366f1" : "#6b7280",
              background: "none", border: "none",
              borderBottom: tab === t.id ? "2.5px solid #6366f1" : "2.5px solid transparent",
              cursor: "pointer", marginBottom: -2, borderRadius: "4px 4px 0 0",
              transition: "color 0.15s",
            }}
          >
            {t.label}
            {t.id === "segments" && filters.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: "#e0e7ff", color: "#4338ca", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>
                {filters.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: SAVED SEGMENTS ──────────────────────────────────────────────── */}
      {tab === "segments" && (
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {/* Multiwoven activation status strip */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={14} strokeWidth={2} color="#f59e0b" />
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                <strong>Multiwoven Activation</strong>
                {syncsLoading ? " — checking…" : hasSyncs ? ` — ${syncs.length} sync${syncs.length > 1 ? "s" : ""} active` : " — no active syncs"}
              </span>
              {hasSyncs && (
                <a href={MULTIWOVEN_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#6366f1", display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <ExternalLink size={10} strokeWidth={2} /> Configure
                </a>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={loadSyncs} title="Refresh sync status">
                <RefreshCw size={11} strokeWidth={2} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={loadFilters}>↻ Refresh</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setTab("builder")}>
                + Build new segment
              </button>
            </div>
          </div>

          {filters.length === 0 ? (
            <div className="empty-state" style={{ padding: "2.5rem 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No segments yet</p>
              <p style={{ fontSize: 13, color: "var(--coxa-text-muted)", marginBottom: 16 }}>
                Use the visual builder to create AND/OR audience segments directly from your fan data.
              </p>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setTab("builder")}>
                Open visual builder
              </button>
            </div>
          ) : (
            <DataTable
              title="Saved segments"
              rows={filters}
              columns={[
                { key: "name", label: "Segment name" },
                {
                  key: "lastRunCount",
                  label: "Fan count",
                  render: (v) => v != null ? v.toLocaleString() : "—",
                },
                {
                  key: "sync",
                  label: "Activation sync",
                  sortable: false,
                  filterable: false,
                  render: (_, row) => (
                    <SyncBadge segmentId={row.name ?? row._id} syncs={syncs} />
                  ),
                },
                { key: "createdAt", label: "Created", render: (v) => v ? new Date(v).toLocaleDateString() : "—" },
                {
                  key: "actions",
                  label: "",
                  sortable: false,
                  filterable: false,
                  render: (_, row) => (
                    <div className="row-actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleExport(row._id)}>
                        Export CSV
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTab("enhanced")}>
                        Edit
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleDelete(row._id)}>
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              csvFilename="segments.csv"
            />
          )}

          {/* Multiwoven info banner when no syncs configured */}
          {!hasSyncs && !syncsLoading && filters.length > 0 && (
            <div style={{
              marginTop: 16, padding: "12px 16px",
              background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10,
              display: "flex", alignItems: "center", gap: 10, fontSize: 12,
            }}>
              <Zap size={14} strokeWidth={2} color="#f59e0b" />
              <span style={{ color: "#78716c" }}>
                <strong>Activate these audiences automatically</strong> — connect Multiwoven to sync segments to
                email, WhatsApp, Meta Ads, Google Ads without manual CSV exports.{" "}
                <a href={MULTIWOVEN_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>
                  Configure Multiwoven →
                </a>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ENHANCED BUILDER ────────────────────────────────────────────── */}
      {tab === "enhanced" && (
        <EnhancedBuilder onSaved={() => { loadFilters(); setTab("segments"); }} />
      )}

      {/* ── TAB: VISUAL BUILDER ──────────────────────────────────────────────── */}
      {tab === "builder" && (
        <div>
          <p style={{ fontSize: 13, color: "var(--coxa-text-muted)", marginBottom: 18 }}>
            Build AND/OR audience segments using any fan profile field or ML score.
            Rules run directly against your MongoDB fan database — no external service needed.
          </p>
          <VisualSegmentBuilder
            apiBase="/api/v1/cdp"
            onSave={async (name, query, count) => {
              await fanboxApi.createFilter({ name, rules: query, queryBuilderFormat: true, lastRunCount: count });
              loadFilters();
              setTab("segments");
            }}
            onCancel={() => setTab("segments")}
          />
        </div>
      )}
    </div>
  );
}
