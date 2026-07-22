/**
 * Segment Service — Phase 3 v2
 *
 * Evaluation strategy:
 *  1. ClickHouse (sub-second, supports ML score filters) — preferred
 *  2. MongoDB in-memory trait evaluation — fallback
 *
 * The service is fully backward-compatible: existing callers continue
 * to work without changes.
 */

import { Segment } from "../models/Segment.js";
import { FanProfile } from "../models/FanProfile.js";
import { getAllFanTraitsMap } from "./traitCalculator.js";
import { getClickhouseClient, isClickhouseEnabled } from "../lib/clickhouseClient.js";
import { buildSegmentQuery, buildCountQuery } from "../lib/segmentQueryBuilder.js";

// ─── Legacy MongoDB in-memory evaluator (fallback) ────────────────────────────

function evaluateRule(traits, rule) {
  const value = traits[rule.traitKey];
  const expected = rule.value;
  switch (rule.operator) {
    case "eq":       return value === expected;
    case "neq":      return value !== expected;
    case "gt":       return Number(value) > Number(expected);
    case "gte":      return Number(value) >= Number(expected);
    case "lt":       return Number(value) < Number(expected);
    case "lte":      return Number(value) <= Number(expected);
    case "contains": return String(value ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "exists":   return expected ? value != null : value == null;
    default:         return false;
  }
}

export function fanMatchesSegment(traits, rules) {
  if (!rules?.length) return false;
  return rules.every((rule) => evaluateRule(traits, rule));
}

// ─── ClickHouse-powered preview ───────────────────────────────────────────────

async function previewViaClickHouse(tenantId, rules) {
  const ch = getClickhouseClient();

  // Count
  const countResult = await ch.query({
    query: buildCountQuery(tenantId, rules),
    format: "JSONEachRow",
  });
  const countRows = await countResult.json();
  const memberCount = Number(countRows[0]?.cnt ?? 0);

  // Sample (top 10 by fan_score)
  const sampleResult = await ch.query({
    query: `
      SELECT fan_profile_id, fan_id, full_name, email
      FROM coxa.fan_360
      WHERE ${buildCountQuery(tenantId, rules).replace("SELECT count() AS cnt FROM coxa.fan_360 WHERE ", "")}
      ORDER BY fan_score DESC
      LIMIT 10
    `,
    format: "JSONEachRow",
  });
  const sampleRows = await sampleResult.json();

  return {
    memberCount,
    sample: sampleRows.map((r) => ({
      id: r.fan_profile_id,
      fanId: r.fan_id,
      fullName: r.full_name,
      email: r.email,
    })),
    engine: "clickhouse",
  };
}

// ─── MongoDB fallback preview ─────────────────────────────────────────────────

async function previewViaMongo(tenantId, rules) {
  const fans = await FanProfile.find({ tenantId, status: "active" });
  const traitsMap = await getAllFanTraitsMap(tenantId);
  const members = fans.filter((fan) =>
    fanMatchesSegment(traitsMap.get(fan._id.toString()) ?? {}, rules),
  );
  return {
    memberCount: members.length,
    sample: members.slice(0, 10).map((f) => ({
      id: f.id,
      fanId: f.fanId,
      fullName: f.fullName,
      email: f.email,
    })),
    engine: "mongodb",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function previewSegment(tenantId, rules) {
  if (isClickhouseEnabled() && rules?.length) {
    try {
      return await previewViaClickHouse(tenantId, rules);
    } catch (err) {
      console.warn("[segmentService] ClickHouse preview failed, falling back:", err.message);
    }
  }
  return previewViaMongo(tenantId, rules);
}

export async function refreshSegmentMemberCounts(tenantId) {
  const segments = await Segment.find({ tenantId, status: "active" });
  for (const segment of segments) {
    const { memberCount } = await previewSegment(tenantId, segment.rules);
    segment.memberCount = memberCount;
    await segment.save();
  }

  // Also write to ClickHouse segment_memberships for fast fan-to-segment lookups
  if (isClickhouseEnabled()) {
    try {
      const ch = getClickhouseClient();
      for (const segment of segments) {
        const result = await ch.query({
          query: buildSegmentQuery(tenantId, segment.rules, { limit: 100000 }),
          format: "JSONEachRow",
        });
        const rows = await result.json();
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);
        const insertRows = rows.map((r) => ({
          tenant_id: tenantId,
          segment_id: segment._id.toString(),
          fan_profile_id: r.fan_profile_id,
          evaluated_at: now,
        }));
        if (insertRows.length > 0) {
          const { createClient } = await import("@clickhouse/client");
          const rawCh = createClient({
            host: process.env.CLICKHOUSE_HOST ? `http://${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_HTTP_PORT ?? 8123}` : "http://localhost:8123",
            username: process.env.CLICKHOUSE_USER ?? "coxa",
            password: process.env.CLICKHOUSE_PASSWORD ?? "coxa_dev_password",
            database: "coxa",
          });
          await rawCh.insert({ table: "segment_memberships", values: insertRows, format: "JSONEachRow" });
          await rawCh.close();
        }
      }
    } catch (err) {
      console.warn("[segmentService] ClickHouse segment_memberships sync failed:", err.message);
    }
  }
}

export async function getFanSegments(tenantId, fanProfileId) {
  const segments = await Segment.find({ tenantId, status: "active" });

  if (isClickhouseEnabled()) {
    try {
      const ch = getClickhouseClient();
      const result = await ch.query({
        query: `
          SELECT DISTINCT segment_id
          FROM coxa.segment_memberships
          WHERE tenant_id = {tenantId:String}
            AND fan_profile_id = {fanProfileId:String}
        `,
        query_params: { tenantId, fanProfileId },
        format: "JSONEachRow",
      });
      const rows = await result.json();
      const segmentIds = new Set(rows.map((r) => r.segment_id));
      return segments.filter((s) => segmentIds.has(s._id.toString()));
    } catch (err) {
      console.warn("[segmentService] ClickHouse getFanSegments failed, falling back:", err.message);
    }
  }

  // MongoDB fallback
  const traitsMap = await getAllFanTraitsMap(tenantId);
  const traits = traitsMap.get(fanProfileId.toString()) ?? {};
  return segments.filter((seg) => fanMatchesSegment(traits, seg.rules));
}

export async function listSegments(tenantId) {
  return Segment.find({ tenantId }).sort({ name: 1 });
}

export async function createSegment(tenantId, { name, description, rules, status, createdBy }) {
  const preview = await previewSegment(tenantId, rules ?? []);
  return Segment.create({
    tenantId,
    name,
    description,
    rules: rules ?? [],
    status: status ?? "active",
    memberCount: preview.memberCount,
    createdBy,
  });
}

export async function updateSegment(tenantId, segmentId, updates) {
  const segment = await Segment.findOne({ _id: segmentId, tenantId });
  if (!segment) {
    const err = new Error("Segment not found");
    err.status = 404;
    err.code = "SEGMENT_NOT_FOUND";
    throw err;
  }
  if (updates.name != null) segment.name = updates.name;
  if (updates.description != null) segment.description = updates.description;
  if (updates.rules != null) segment.rules = updates.rules;
  if (updates.status != null) segment.status = updates.status;

  const preview = await previewSegment(tenantId, segment.rules);
  segment.memberCount = preview.memberCount;
  await segment.save();
  return segment;
}
