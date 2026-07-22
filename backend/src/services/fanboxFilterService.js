import { SavedFilter } from "../models/SavedFilter.js";
import { FanProfile } from "../models/FanProfile.js";
import { Segment } from "../models/Segment.js";
import { isAllowedField } from "../lib/filterFields.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  return Boolean(value);
}

function buildRuleClause(rule) {
  if (!rule?.field || !rule.operator) return null;
  if (String(rule.field).includes("$")) return null;
  // WS2.8 — enforce field whitelist
  if (!isAllowedField(rule.field)) return null;

  const field = rule.field;
  const value = rule.value;

  switch (rule.operator) {
    case "eq":
      return { [field]: value };
    case "neq":
      return { [field]: { $ne: value } };
    case "gt":
      return { [field]: { $gt: value } };
    case "gte":
      return { [field]: { $gte: value } };
    case "lt":
      return { [field]: { $lt: value } };
    case "lte":
      return { [field]: { $lte: value } };
    case "contains":
      return { [field]: { $regex: escapeRegex(value ?? ""), $options: "i" } };
    case "exists":
      return { [field]: { $exists: parseBoolean(value) } };
    case "in":
      return { [field]: { $in: Array.isArray(value) ? value : [value] } };
    default:
      return null;
  }
}

export function buildProfileQuery(tenantId, rules = []) {
  const clauses = rules.map(buildRuleClause).filter(Boolean);
  const query = { tenantId, status: "active" };
  if (clauses.length) query.$and = clauses;
  return query;
}

function csvEscape(value) {
  if (value == null) return "";
  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (!/[,"\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, "\"\"")}"`;
}

function mapFilterRulesToSegmentRules(rules = []) {
  return rules.map((rule) => {
    const operator = rule.operator === "in" ? "contains" : rule.operator;
    return {
      traitKey: rule.field,
      operator,
      value: rule.value,
    };
  });
}

async function getFilterOrThrow(tenantId, filterId) {
  const filter = await SavedFilter.findOne({ _id: filterId, tenantId });
  if (!filter) {
    const err = new Error("Saved filter not found");
    err.status = 404;
    err.code = "SAVED_FILTER_NOT_FOUND";
    throw err;
  }
  return filter;
}

export async function listSavedFilters(tenantId, { limit = 100 } = {}) {
  return SavedFilter.find({ tenantId }).sort({ createdAt: -1 }).limit(Number(limit));
}

export async function createSavedFilter(tenantId, payload) {
  const filter = await SavedFilter.create({
    tenantId,
    name: payload.name,
    rules: payload.rules ?? [],
    createdBy: payload.createdBy,
  });
  const preview = await previewFilter(tenantId, filter.rules);
  filter.lastRunCount = preview.count;
  filter.lastRunAt = new Date();
  await filter.save();
  return filter;
}

export async function updateSavedFilter(tenantId, filterId, updates) {
  const filter = await getFilterOrThrow(tenantId, filterId);
  if (updates.name != null) filter.name = updates.name;
  if (updates.rules != null) filter.rules = updates.rules;

  const preview = await previewFilter(tenantId, filter.rules);
  filter.lastRunCount = preview.count;
  filter.lastRunAt = new Date();
  await filter.save();
  return filter;
}

export async function deleteSavedFilter(tenantId, filterId) {
  const filter = await getFilterOrThrow(tenantId, filterId);
  await filter.deleteOne();
  return { id: filterId, deleted: true };
}

export async function previewFilter(tenantId, rules = []) {
  const query = buildProfileQuery(tenantId, rules);
  const [count, sample] = await Promise.all([
    FanProfile.countDocuments(query),
    FanProfile.find(query).sort({ createdAt: -1 }).limit(10).select("fanId fullName email phone"),
  ]);
  return { count, sample };
}

export async function exportFilterCsv(tenantId, filterId) {
  const filter = await getFilterOrThrow(tenantId, filterId);
  const fans = await FanProfile.find(buildProfileQuery(tenantId, filter.rules))
    .sort({ createdAt: -1 })
    .select("fanId fullName email phone cpf status address.city address.state createdAt");

  const headers = [
    "fanId",
    "fullName",
    "email",
    "phone",
    "cpf",
    "status",
    "city",
    "state",
    "createdAt",
  ];

  const lines = fans.map((fan) =>
    [
      fan.fanId,
      fan.fullName,
      fan.email,
      fan.phone,
      fan.cpf,
      fan.status,
      fan.address?.city,
      fan.address?.state,
      fan.createdAt?.toISOString?.() ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export async function promoteFilterToSegment(tenantId, filterId) {
  const filter = await getFilterOrThrow(tenantId, filterId);
  const preview = await previewFilter(tenantId, filter.rules);
  const segment = await Segment.create({
    tenantId,
    name: filter.name,
    description: `Promoted from saved filter ${filter.name}`,
    rules: mapFilterRulesToSegmentRules(filter.rules),
    status: "active",
    memberCount: preview.count,
    createdBy: filter.createdBy,
  });
  return segment;
}
