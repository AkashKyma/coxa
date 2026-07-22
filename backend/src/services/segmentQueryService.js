/**
 * Segment Query Service
 *
 * Translates react-querybuilder JSON (RuleGroup/Rule tree) into a MongoDB
 * aggregation pipeline that joins FanProfile + FanScore and returns matching fans.
 *
 * Supported field sources:
 *   - FanProfile fields: fullName, email, gender, status, address.city, address.state,
 *     address.country, isForeigner, hasChildren, ageRange, householdIncomeBand,
 *     sportsBetting, biometricRegistered, createdAt
 *   - FanScore fields (joined): totalScore, tier, attendanceScore, spendingScore,
 *     referralScore, engagementScore, churnRiskScore*, ticketPropensity*, retailPropensity*,
 *     nextBestChannel*    (* stored on FanProfile via ML writeback)
 *
 * react-querybuilder rule shape:
 *   { combinator: "and"|"or", rules: [ Rule | RuleGroup ] }
 *   Rule: { field, operator, value }
 */

import { FanProfile } from "../models/FanProfile.js";
import { FanScore } from "../models/FanScore.js";

// Fields that live on FanScore (joined via $lookup); all others → FanProfile
const SCORE_FIELDS = new Set([
  "totalScore", "tier",
  "attendanceScore", "tenureScore", "spendingScore",
  "referralScore", "engagementScore", "donationScore",
]);

// Allowed field list — prevents arbitrary MongoDB field injection
const ALLOWED_FIELDS = new Set([
  // FanProfile
  "fullName", "email", "gender", "status",
  "address.city", "address.state", "address.country",
  "isForeigner", "hasChildren", "ageRange", "householdIncomeBand",
  "sportsBetting", "biometricRegistered",
  "churnRiskScore", "ticketPropensity", "retailPropensity", "nextBestChannel",
  "createdAt",
  // FanScore (joined)
  "totalScore", "tier",
  "attendanceScore", "tenureScore", "spendingScore",
  "referralScore", "engagementScore", "donationScore",
]);

/**
 * Convert a single Rule to a MongoDB $match expression fragment.
 * Returns null for unsupported / invalid rules (they are silently skipped).
 */
function ruleToMongoExpr(rule) {
  const { field, operator, value } = rule;
  if (!field || !ALLOWED_FIELDS.has(field)) return null;

  // Score fields are prefixed after $lookup
  const mongoField = SCORE_FIELDS.has(field) ? `score.${field}` : field;

  // Cast value to number for numeric fields
  const numFields = new Set([
    "totalScore", "attendanceScore", "tenureScore", "spendingScore",
    "referralScore", "engagementScore", "donationScore",
    "churnRiskScore", "ticketPropensity", "retailPropensity",
  ]);
  const coerced = numFields.has(field) ? Number(value) : value;

  switch (operator) {
    case "=":
    case "eq":
      return { [mongoField]: { $eq: coerced } };
    case "!=":
    case "ne":
      return { [mongoField]: { $ne: coerced } };
    case ">":
    case "gt":
      return { [mongoField]: { $gt: coerced } };
    case ">=":
    case "gte":
      return { [mongoField]: { $gte: coerced } };
    case "<":
    case "lt":
      return { [mongoField]: { $lt: coerced } };
    case "<=":
    case "lte":
      return { [mongoField]: { $lte: coerced } };
    case "contains":
      return { [mongoField]: { $regex: String(value), $options: "i" } };
    case "doesNotContain":
      return { [mongoField]: { $not: { $regex: String(value), $options: "i" } } };
    case "beginsWith":
      return { [mongoField]: { $regex: `^${String(value)}`, $options: "i" } };
    case "endsWith":
      return { [mongoField]: { $regex: `${String(value)}$`, $options: "i" } };
    case "null":
    case "isNull":
      return { [mongoField]: { $in: [null, ""] } };
    case "notNull":
    case "isNotNull":
      return { [mongoField]: { $nin: [null, ""] } };
    case "in": {
      const arr = Array.isArray(value)
        ? value
        : String(value).split(",").map((v) => v.trim()).filter(Boolean);
      return { [mongoField]: { $in: arr } };
    }
    case "notIn": {
      const arr = Array.isArray(value)
        ? value
        : String(value).split(",").map((v) => v.trim()).filter(Boolean);
      return { [mongoField]: { $nin: arr } };
    }
    case "between": {
      const [min, max] = Array.isArray(value) ? value : String(value).split(",").map(Number);
      return { [mongoField]: { $gte: min, $lte: max } };
    }
    default:
      return null;
  }
}

/**
 * Recursively build a MongoDB $match expression from a RuleGroup tree.
 */
function groupToMongoExpr(group) {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
    return {};
  }

  const combinator = (group.combinator ?? "and").toLowerCase() === "or" ? "$or" : "$and";

  const parts = group.rules
    .map((item) => {
      if (Array.isArray(item.rules)) return groupToMongoExpr(item); // nested group
      return ruleToMongoExpr(item);
    })
    .filter(Boolean);

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { [combinator]: parts };
}

/**
 * Run a query-builder segment against MongoDB and return matched fans.
 *
 * @param {string} tenantId
 * @param {object} queryGroup  - react-querybuilder RuleGroup JSON
 * @param {object} opts
 * @param {number} [opts.limit=200]
 * @param {number} [opts.skip=0]
 * @param {boolean} [opts.countOnly=false]  - if true return { count } only
 */
export async function runSegmentQuery(tenantId, queryGroup, { limit = 200, skip = 0, countOnly = false } = {}) {
  const filterExpr = groupToMongoExpr(queryGroup);

  // Build aggregation: start from FanProfile, left-join FanScore
  const pipeline = [
    // 1. Filter by tenant first (index hit)
    { $match: { tenantId, status: { $ne: "merged" } } },

    // 2. Join FanScore (one-to-one)
    {
      $lookup: {
        from: "fanscores",
        localField: "_id",
        foreignField: "fanProfileId",
        as: "scoreArr",
      },
    },
    { $addFields: { score: { $ifNull: [{ $arrayElemAt: ["$scoreArr", 0] }, {}] } } },
    { $unset: "scoreArr" },

    // 3. Apply the user's filter rules
    ...(Object.keys(filterExpr).length ? [{ $match: filterExpr }] : []),
  ];

  if (countOnly) {
    const countPipeline = [...pipeline, { $count: "total" }];
    const result = await FanProfile.aggregate(countPipeline);
    return { count: result[0]?.total ?? 0 };
  }

  pipeline.push(
    { $sort: { "score.totalScore": -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: Math.min(limit, 500) },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        fullName: 1,
        email: 1,
        gender: 1,
        status: 1,
        city: "$address.city",
        country: "$address.country",
        tier: "$score.tier",
        totalScore: "$score.totalScore",
        churnRiskScore: 1,
        ticketPropensity: 1,
        retailPropensity: 1,
        nextBestChannel: 1,
        createdAt: 1,
      },
    },
  );

  const fans = await FanProfile.aggregate(pipeline);
  return { fans, count: fans.length };
}

/**
 * Just count matching fans (lightweight preview).
 */
export async function countSegmentQuery(tenantId, queryGroup) {
  return runSegmentQuery(tenantId, queryGroup, { countOnly: true });
}
