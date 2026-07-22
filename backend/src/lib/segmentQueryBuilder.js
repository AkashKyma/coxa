/**
 * Segment Query Builder — Phase 3
 *
 * Translates Segment rule arrays into ClickHouse SQL WHERE clauses.
 * Supports AND/OR/NOT logic, all operators, and ML score fields.
 *
 * Trait-key map:
 *   MongoDB FanProfile fields  → ClickHouse fan_360 column names
 *   FanTrait computed keys     → ClickHouse fan_360 / fan_features columns
 *   ML score keys              → churn_risk_score, ticket_propensity, etc.
 */

// ── Column mapping: traitKey → ClickHouse column ─────────────────────────────

const TRAIT_TO_COLUMN = {
  // Profile fields
  fanScore:             "fan_score",
  membershipStatus:     "membership_status",
  membershipPlanCode:   "membership_plan_code",
  membershipTierLevel:  "membership_tier_level",
  hasCpf:               "has_cpf",
  isForeigner:          "is_foreigner",
  // Aggregated stats
  totalTicketsPurchased: "total_tickets_purchased",
  totalTicketsUsed:     "total_tickets_used",
  totalSalesCount:      "total_sales_count",
  totalSalesCents:      "total_sales_cents",
  totalLoyaltyPoints:   "total_loyalty_points",
  totalLoyaltyRedeemed: "total_loyalty_redeemed",
  totalCheckins:        "total_checkins",
  // ML scores
  churnRiskScore:       "churn_risk_score",
  ticketPropensity:     "ticket_propensity",
  retailPropensity:     "retail_propensity",
  nextBestChannel:      "next_best_channel",
  // Derived (from fan_features — join required for these)
  daysSinceLastActivity: "days_since_last_activity",
  ticketUseRate:        "ticket_use_rate",
  loyaltyRedemptionRate: "loyalty_redemption_rate",
};

const STRING_COLUMNS = new Set([
  "membership_status", "membership_plan_code", "next_best_channel",
]);

// ── Operator → SQL ────────────────────────────────────────────────────────────

function operatorToSql(column, operator, value) {
  const isStr = STRING_COLUMNS.has(column);
  const esc = isStr
    ? `'${String(value).replace(/'/g, "\\'")}'`
    : Number(value);

  switch (operator) {
    case "eq":      return `${column} = ${esc}`;
    case "neq":     return `${column} != ${esc}`;
    case "gt":      return `${column} > ${esc}`;
    case "gte":     return `${column} >= ${esc}`;
    case "lt":      return `${column} < ${esc}`;
    case "lte":     return `${column} <= ${esc}`;
    case "contains":
      return `positionCaseInsensitive(${column}, '${String(value).replace(/'/g, "\\'")}') > 0`;
    case "exists":
      return value ? `${column} != ''` : `${column} = ''`;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

// ── Single-rule → SQL fragment ────────────────────────────────────────────────

function ruleToSql(rule) {
  const column = TRAIT_TO_COLUMN[rule.traitKey];
  if (!column) {
    console.warn(`[segmentQueryBuilder] Unknown traitKey: ${rule.traitKey} — skipping rule`);
    return "1=1"; // neutral clause so query still runs
  }
  return operatorToSql(column, rule.operator, rule.value);
}

// ── Rule group → SQL ─────────────────────────────────────────────────────────

/**
 * Builds a WHERE clause from a Segment's rule definition.
 *
 * Rule format supports two shapes:
 *   A) Legacy flat array (AND of all rules):
 *      [ { traitKey, operator, value }, ... ]
 *
 *   B) Extended (AND/OR/NOT groups):
 *      { combinator: "and"|"or", rules: [...], not: false }
 *      Nested groups are supported.
 */
export function buildWhereClause(rulesOrGroup, tenantId) {
  let clause;

  if (Array.isArray(rulesOrGroup)) {
    // Legacy format: flat AND
    const parts = rulesOrGroup.map(ruleToSql).filter(Boolean);
    clause = parts.length > 0 ? parts.join(" AND ") : "1=1";
  } else if (rulesOrGroup && typeof rulesOrGroup === "object") {
    clause = buildGroupSql(rulesOrGroup);
  } else {
    clause = "1=1";
  }

  const tenantEsc = String(tenantId).replace(/'/g, "\\'");
  return `tenant_id = '${tenantEsc}' AND (${clause})`;
}

function buildGroupSql(group) {
  if (!group.rules?.length) return "1=1";

  const combinator = group.combinator === "or" ? " OR " : " AND ";
  const parts = group.rules.map((item) => {
    // Nested group
    if (item.rules) return `(${buildGroupSql(item)})`;
    // Leaf rule
    return ruleToSql(item);
  });

  const joined = parts.join(combinator);
  return group.not ? `NOT (${joined})` : joined;
}

// ── Full ClickHouse query to find matching fan_profile_ids ────────────────────

export function buildSegmentQuery(tenantId, rules, { limit = 50000 } = {}) {
  const where = buildWhereClause(rules, tenantId);
  return `
    SELECT fan_profile_id
    FROM coxa.fan_360
    WHERE ${where}
    ORDER BY fan_score DESC
    LIMIT ${limit}
  `;
}

// ── Count query ───────────────────────────────────────────────────────────────

export function buildCountQuery(tenantId, rules) {
  const where = buildWhereClause(rules, tenantId);
  return `SELECT count() AS cnt FROM coxa.fan_360 WHERE ${where}`;
}
