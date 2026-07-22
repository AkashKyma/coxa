/**
 * VisualSegmentBuilder
 *
 * A rich drag-and-drop AND/OR query builder that works directly against
 * the Coxa MongoDB FanProfile + FanScore collections via the backend API.
 *
 * Features:
 *  - Nested AND / OR groups (react-querybuilder)
 *  - Live fan count preview (debounced)
 *  - Paginated fan results table
 *  - Save segment → calls onSave(name, query)
 *  - Load / edit existing segment query
 *
 * Props:
 *   apiBase       string  – e.g. "/api/v1/cdp"
 *   initialQuery  object  – optional pre-loaded RuleGroup
 *   initialName   string  – optional segment name
 *   onSave        fn(name, query, count) – called when user saves
 *   onCancel      fn()    – optional cancel handler
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { QueryBuilder, defaultOperators, add, remove, update } from "react-querybuilder";
import "react-querybuilder/dist/query-builder.css";

// ── Field definitions mapping FanProfile + FanScore ──────────────────────────
export const SEGMENT_FIELDS = [
  // Profile fields
  { name: "fullName",              label: "Full Name",               inputType: "text" },
  { name: "email",                 label: "Email",                   inputType: "text" },
  {
    name: "gender", label: "Gender",
    valueEditorType: "select",
    values: [
      { name: "male",    label: "Male" },
      { name: "female",  label: "Female" },
      { name: "other",   label: "Other" },
      { name: "unknown", label: "Unknown" },
    ],
    operators: defaultOperators.filter((o) => ["=", "!="].includes(o.name)),
  },
  {
    name: "status", label: "Profile Status",
    valueEditorType: "select",
    values: [
      { name: "active",   label: "Active" },
      { name: "inactive", label: "Inactive" },
      { name: "lead",     label: "Lead" },
    ],
    operators: defaultOperators.filter((o) => ["=", "!="].includes(o.name)),
  },
  { name: "address.city",    label: "City",    inputType: "text" },
  { name: "address.state",   label: "State",   inputType: "text" },
  { name: "address.country", label: "Country", inputType: "text" },
  {
    name: "isForeigner", label: "Is Foreigner",
    valueEditorType: "select",
    values: [{ name: "true", label: "Yes" }, { name: "false", label: "No" }],
    operators: defaultOperators.filter((o) => o.name === "="),
  },
  {
    name: "hasChildren", label: "Has Children",
    valueEditorType: "select",
    values: [
      { name: "yes",     label: "Yes" },
      { name: "no",      label: "No" },
      { name: "unknown", label: "Unknown" },
    ],
    operators: defaultOperators.filter((o) => ["=", "!="].includes(o.name)),
  },
  { name: "ageRange",             label: "Age Range",               inputType: "text" },
  { name: "householdIncomeBand",  label: "Household Income Band",   inputType: "text" },
  {
    name: "sportsBetting", label: "Sports Betting Interest",
    valueEditorType: "select",
    values: [{ name: "true", label: "Yes" }, { name: "false", label: "No" }],
    operators: defaultOperators.filter((o) => o.name === "="),
  },
  {
    name: "biometricRegistered", label: "Biometric Registered",
    valueEditorType: "select",
    values: [{ name: "true", label: "Yes" }, { name: "false", label: "No" }],
    operators: defaultOperators.filter((o) => o.name === "="),
  },
  { name: "createdAt", label: "Member Since", inputType: "date" },

  // ML Scores (written back by Dagster nightly)
  { name: "churnRiskScore",    label: "Churn Risk Score (0–1)",    inputType: "number" },
  { name: "ticketPropensity",  label: "Ticket Propensity (0–1)",   inputType: "number" },
  { name: "retailPropensity",  label: "Retail Propensity (0–1)",   inputType: "number" },
  {
    name: "nextBestChannel", label: "Next Best Channel",
    valueEditorType: "select",
    values: [
      { name: "push",      label: "Push" },
      { name: "email",     label: "Email" },
      { name: "whatsapp",  label: "WhatsApp" },
      { name: "sms",       label: "SMS" },
    ],
    operators: defaultOperators.filter((o) => ["=", "!="].includes(o.name)),
  },

  // Fan Score (joined)
  { name: "totalScore", label: "Fan Score (total)", inputType: "number" },
  {
    name: "tier", label: "Fan Tier",
    valueEditorType: "select",
    values: [
      { name: "bronze",   label: "Bronze" },
      { name: "silver",   label: "Silver" },
      { name: "gold",     label: "Gold" },
      { name: "platinum", label: "Platinum" },
      { name: "diamond",  label: "Diamond" },
    ],
    operators: defaultOperators.filter((o) => ["=", "!="].includes(o.name)),
  },
  { name: "attendanceScore",  label: "Attendance Score",  inputType: "number" },
  { name: "spendingScore",    label: "Spending Score",    inputType: "number" },
  { name: "referralScore",    label: "Referral Score",    inputType: "number" },
  { name: "engagementScore",  label: "Engagement Score",  inputType: "number" },
];

const EMPTY_QUERY = { combinator: "and", rules: [] };

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Fan result row ────────────────────────────────────────────────────────────
const TIER_COLORS = {
  diamond:  { bg: "#e0f2fe", color: "#0369a1" },
  platinum: { bg: "#f3e8ff", color: "#7e22ce" },
  gold:     { bg: "#fef9c3", color: "#854d0e" },
  silver:   { bg: "#f1f5f9", color: "#475569" },
  bronze:   { bg: "#fef3c7", color: "#92400e" },
};

function TierBadge({ tier }) {
  const s = TIER_COLORS[tier] ?? TIER_COLORS.bronze;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
      background: s.bg, color: s.color, textTransform: "capitalize",
    }}>
      {tier ?? "—"}
    </span>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ value, max = 1, color = "#6366f1" }) {
  const pct = Math.min(100, Math.round(((value ?? 0) / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
      <div style={{ flex: 1, height: 5, background: "#e2e8f0", borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>{pct}%</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VisualSegmentBuilder({
  apiBase = "/api/v1/cdp",
  initialQuery = EMPTY_QUERY,
  initialName = "",
  onSave,
  onCancel,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [segmentName, setSegmentName] = useState(initialName);
  const [count, setCount] = useState(null);
  const [countLoading, setCountLoading] = useState(false);
  const [fans, setFans] = useState([]);
  const [fansLoading, setFansLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [page, setPage] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 50;

  const debouncedQuery = useDebounce(query, 700);
  const hasRules = query.rules && query.rules.length > 0;

  // Auto-count on query change (debounced)
  useEffect(() => {
    if (!hasRules) { setCount(null); return; }
    setCountLoading(true);
    fetch(`${apiBase}/segments/query/count`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query: debouncedQuery }),
    })
      .then((r) => r.json())
      .then((r) => setCount(r.count ?? 0))
      .catch(() => setCount(null))
      .finally(() => setCountLoading(false));
  }, [debouncedQuery, apiBase, hasRules]);

  async function loadFans(pageNum = 0) {
    if (!hasRules) return;
    setFansLoading(true);
    setShowResults(true);
    setPage(pageNum);
    try {
      const res = await fetch(`${apiBase}/segments/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query, limit: PAGE_SIZE, skip: pageNum * PAGE_SIZE }),
      });
      const json = await res.json();
      setFans(json.data ?? []);
    } catch {
      setFans([]);
    } finally {
      setFansLoading(false);
    }
  }

  async function handleSave() {
    if (!segmentName.trim()) { setSaveError("Segment name is required."); return; }
    if (!hasRules) { setSaveError("Add at least one rule."); return; }
    setSaving(true); setSaveError("");
    try {
      await onSave?.(segmentName.trim(), query, count ?? 0);
      setSaveError("");
    } catch (err) {
      setSaveError(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ fontFamily: "inherit" }}>
      {/* ── Segment name ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Segment name (e.g. High-value São Paulo fans)"
          value={segmentName}
          onChange={(e) => setSegmentName(e.target.value)}
        />
        {count !== null && (
          <span style={{
            fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
            background: count > 0 ? "#d1fae5" : "#f3f4f6",
            color: count > 0 ? "#065f46" : "#6b7280",
          }}>
            {countLoading ? "…" : `${count.toLocaleString()} fans match`}
          </span>
        )}
        {countLoading && count === null && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Counting…</span>
        )}
      </div>

      {/* ── Query Builder ─────────────────────────────────────────────────── */}
      <div style={{
        border: "1.5px solid #e0e7ff", borderRadius: 12, padding: "16px 18px",
        background: "#f8faff", marginBottom: 18,
      }}>
        <QueryBuilder
          fields={SEGMENT_FIELDS}
          query={query}
          onQueryChange={setQuery}
          addRuleToNewGroups
          showCombinatorsBetweenRules={false}
          controlClassnames={{
            queryBuilder: "qb-root",
            ruleGroup: "qb-group",
            header: "qb-group-header",
            body: "qb-group-body",
            combinators: "input input--sm qb-combinator",
            addRule: "btn btn--ghost btn--sm",
            addGroup: "btn btn--ghost btn--sm",
            removeGroup: "btn btn--ghost btn--sm btn--danger-ghost",
            removeRule: "btn btn--ghost btn--xs btn--danger-ghost",
            fields: "input input--sm",
            operators: "input input--sm",
            value: "input input--sm",
          }}
          translations={{
            addRule: { label: "+ Add rule" },
            addGroup: { label: "+ Add group" },
            removeGroup: { label: "✕" },
            removeRule: { label: "✕" },
          }}
        />
      </div>

      {/* ── Actions row ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={!hasRules || fansLoading}
          onClick={() => loadFans(0)}
        >
          {fansLoading ? "Loading…" : "Preview fans"}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!hasRules || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save segment"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        {saveError && (
          <span style={{ fontSize: 12, color: "#dc2626" }}>{saveError}</span>
        )}
        {!hasRules && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Add at least one rule to preview or save.</span>
        )}
      </div>

      {/* ── Fan results table ──────────────────────────────────────────────── */}
      {showResults && (
        <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "12px 16px", background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              Matched fans
              {fans.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: "#6b7280" }}>
                  (showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + fans.length})
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {page > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => loadFans(page - 1)}>
                  ← Prev
                </button>
              )}
              {fans.length === PAGE_SIZE && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => loadFans(page + 1)}>
                  Next →
                </button>
              )}
            </div>
          </div>

          {fansLoading ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Loading fans…
            </div>
          ) : fans.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              No fans match these rules.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    {["Name", "Email", "City", "Tier", "Fan Score", "Churn Risk", "Ticket Prop.", "Channel"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 11, whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fans.map((fan, i) => (
                    <tr key={fan.id ?? i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "7px 12px", fontWeight: 600 }}>{fan.fullName}</td>
                      <td style={{ padding: "7px 12px", color: "#6366f1" }}>{fan.email}</td>
                      <td style={{ padding: "7px 12px", color: "#64748b" }}>{fan.city ?? "—"}</td>
                      <td style={{ padding: "7px 12px" }}><TierBadge tier={fan.tier} /></td>
                      <td style={{ padding: "7px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 50, height: 5, background: "#e2e8f0", borderRadius: 3 }}>
                            <div style={{ width: `${Math.min(100, Math.round((fan.totalScore ?? 0) / 1000))}%`, height: "100%", background: "#6366f1", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, color: "#6b7280" }}>{(fan.totalScore ?? 0).toLocaleString()}</span>
                        </div>
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        {fan.churnRiskScore != null
                          ? <ScoreBar value={fan.churnRiskScore} color="#ef4444" />
                          : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        {fan.ticketPropensity != null
                          ? <ScoreBar value={fan.ticketPropensity} color="#3b82f6" />
                          : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        {fan.nextBestChannel ? (
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "capitalize", color: "#7c3aed" }}>
                            {fan.nextBestChannel}
                          </span>
                        ) : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
