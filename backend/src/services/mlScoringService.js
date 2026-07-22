/**
 * ML Scoring Service — Phase 3
 *
 * Reads ML scores from ClickHouse fan_360 / fan_features.
 * Scores are written by the Dagster ml_scoring_job that runs nightly at 02:00.
 *
 * All functions fall back gracefully to MongoDB-stored scores when ClickHouse
 * is unavailable.
 */

import { getClickhouseClient, isClickhouseEnabled } from "../lib/clickhouseClient.js";
import { FanProfile } from "../models/FanProfile.js";

// ─── Single-fan scores ────────────────────────────────────────────────────────

export async function getFanMlScores(tenantId, fanProfileId) {
  if (isClickhouseEnabled()) {
    try {
      const ch = getClickhouseClient();
      const result = await ch.query({
        query: `
          SELECT
            fan_profile_id,
            churn_risk_score,
            ticket_propensity,
            retail_propensity,
            next_best_channel,
            ml_scores_updated_at
          FROM coxa.fan_360
          WHERE tenant_id = {tenantId:String}
            AND fan_profile_id = {fanProfileId:String}
          LIMIT 1
        `,
        query_params: { tenantId, fanProfileId },
        format: "JSONEachRow",
      });
      const rows = await result.json();
      if (rows.length > 0) {
        return normaliseScoreRow(rows[0]);
      }
    } catch (err) {
      console.warn("[mlScoringService] ClickHouse unavailable, falling back to MongoDB:", err.message);
    }
  }

  // MongoDB fallback
  const fan = await FanProfile.findOne(
    { _id: fanProfileId, tenantId },
    "churnRiskScore ticketPropensity retailPropensity nextBestChannel mlScoresUpdatedAt",
  ).lean();

  if (!fan) return null;
  return {
    fanProfileId,
    churnRiskScore: fan.churnRiskScore ?? 0,
    ticketPropensity: fan.ticketPropensity ?? 0,
    retailPropensity: fan.retailPropensity ?? 0,
    nextBestChannel: fan.nextBestChannel ?? null,
    mlScoresUpdatedAt: fan.mlScoresUpdatedAt ?? null,
    source: "mongodb",
  };
}

// ─── Batch scores for a tenant ────────────────────────────────────────────────

export async function getBatchMlScores(tenantId, { limit = 1000, offset = 0 } = {}) {
  if (isClickhouseEnabled()) {
    try {
      const ch = getClickhouseClient();
      const result = await ch.query({
        query: `
          SELECT
            fan_profile_id,
            churn_risk_score,
            ticket_propensity,
            retail_propensity,
            next_best_channel,
            ml_scores_updated_at
          FROM coxa.fan_360
          WHERE tenant_id = {tenantId:String}
            AND ml_scores_updated_at > toDateTime(0)
          ORDER BY churn_risk_score DESC
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        query_params: { tenantId, limit, offset },
        format: "JSONEachRow",
      });
      const rows = await result.json();
      return rows.map(normaliseScoreRow);
    } catch (err) {
      console.warn("[mlScoringService] ClickHouse batch query failed:", err.message);
    }
  }

  // MongoDB fallback
  const fans = await FanProfile.find(
    { tenantId, status: "active", mlScoresUpdatedAt: { $ne: null } },
    "churnRiskScore ticketPropensity retailPropensity nextBestChannel mlScoresUpdatedAt",
  )
    .sort({ churnRiskScore: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return fans.map((f) => ({
    fanProfileId: f._id.toString(),
    churnRiskScore: f.churnRiskScore ?? 0,
    ticketPropensity: f.ticketPropensity ?? 0,
    retailPropensity: f.retailPropensity ?? 0,
    nextBestChannel: f.nextBestChannel ?? null,
    mlScoresUpdatedAt: f.mlScoresUpdatedAt ?? null,
    source: "mongodb",
  }));
}

// ─── Churn-risk summary (used by InsightsPage ML cards) ──────────────────────

export async function getChurnRiskSummary(tenantId) {
  if (isClickhouseEnabled()) {
    try {
      const ch = getClickhouseClient();
      const result = await ch.query({
        query: `
          SELECT
            countIf(churn_risk_score >= 0.7)  AS high_risk_fans,
            countIf(churn_risk_score >= 0.4 AND churn_risk_score < 0.7) AS medium_risk_fans,
            countIf(churn_risk_score < 0.4)   AS low_risk_fans,
            avg(churn_risk_score)              AS avg_churn_score,
            avg(ticket_propensity)             AS avg_ticket_propensity,
            avg(retail_propensity)             AS avg_retail_propensity,
            max(ml_scores_updated_at)          AS last_scored_at
          FROM coxa.fan_360
          WHERE tenant_id = {tenantId:String}
        `,
        query_params: { tenantId },
        format: "JSONEachRow",
      });
      const rows = await result.json();
      return rows[0] ?? getDefaultSummary();
    } catch (err) {
      console.warn("[mlScoringService] ClickHouse summary query failed:", err.message);
    }
  }

  // MongoDB fallback
  const stats = await FanProfile.aggregate([
    { $match: { tenantId, status: "active" } },
    {
      $group: {
        _id: null,
        high_risk_fans: { $sum: { $cond: [{ $gte: ["$churnRiskScore", 0.7] }, 1, 0] } },
        medium_risk_fans: {
          $sum: { $cond: [{ $and: [{ $gte: ["$churnRiskScore", 0.4] }, { $lt: ["$churnRiskScore", 0.7] }] }, 1, 0] },
        },
        low_risk_fans: { $sum: { $cond: [{ $lt: ["$churnRiskScore", 0.4] }, 1, 0] } },
        avg_churn_score: { $avg: "$churnRiskScore" },
        avg_ticket_propensity: { $avg: "$ticketPropensity" },
        avg_retail_propensity: { $avg: "$retailPropensity" },
        last_scored_at: { $max: "$mlScoresUpdatedAt" },
      },
    },
  ]);

  return stats[0] ?? getDefaultSummary();
}

// ─── Channel distribution ─────────────────────────────────────────────────────

export async function getChannelDistribution(tenantId) {
  if (isClickhouseEnabled()) {
    try {
      const ch = getClickhouseClient();
      const result = await ch.query({
        query: `
          SELECT
            next_best_channel,
            count() AS fan_count
          FROM coxa.fan_360
          WHERE tenant_id = {tenantId:String}
            AND next_best_channel != ''
          GROUP BY next_best_channel
          ORDER BY fan_count DESC
        `,
        query_params: { tenantId },
        format: "JSONEachRow",
      });
      return await result.json();
    } catch (err) {
      console.warn("[mlScoringService] channel distribution query failed:", err.message);
    }
  }

  const agg = await FanProfile.aggregate([
    { $match: { tenantId, status: "active", nextBestChannel: { $ne: null } } },
    { $group: { _id: "$nextBestChannel", fan_count: { $sum: 1 } } },
    { $project: { next_best_channel: "$_id", fan_count: 1, _id: 0 } },
    { $sort: { fan_count: -1 } },
  ]);
  return agg;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normaliseScoreRow(row) {
  return {
    fanProfileId: row.fan_profile_id,
    churnRiskScore: Number(row.churn_risk_score ?? 0),
    ticketPropensity: Number(row.ticket_propensity ?? 0),
    retailPropensity: Number(row.retail_propensity ?? 0),
    nextBestChannel: row.next_best_channel || null,
    mlScoresUpdatedAt: row.ml_scores_updated_at || null,
    source: "clickhouse",
  };
}

function getDefaultSummary() {
  return {
    high_risk_fans: 0,
    medium_risk_fans: 0,
    low_risk_fans: 0,
    avg_churn_score: 0,
    avg_ticket_propensity: 0,
    avg_retail_propensity: 0,
    last_scored_at: null,
  };
}
