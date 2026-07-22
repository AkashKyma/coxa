/**
 * Personalization Service v2 — Phase 4
 *
 * Upgrades over v1 (personalizationService.js):
 *  - Returns top-3 offers (not just the single best)
 *  - Frequency capping: hides offers shown >3 times in 7 days
 *  - A/B variant assignment: deterministic hash on fanProfileId+offerId
 *  - ML propensity boosts: ticket offers boosted for high-propensity fans
 *  - Records OfferImpression on every call
 *
 * All functions are additive — existing callers of personalizationService.js
 * are unaffected. New callers should import from this file.
 */

import crypto from "crypto";
import { getFanSegments } from "./segmentService.js";
import { getBalance } from "./loyaltyService.js";
import { getFanTraits } from "./traitCalculator.js";
import { getFanMlScores } from "./mlScoringService.js";
import { Offer } from "../models/Offer.js";
import { OfferImpression } from "../models/OfferImpression.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQUENCY_CAP = 3;          // max impressions per offer per fan in 7 days
const FREQUENCY_WINDOW_DAYS = 7;
const TOP_N = 3;                   // number of offers to return
const AB_VARIANTS = ["A", "B"];    // variant pool
const AB_SPLIT = 0.5;             // 50/50 A/B split

// ── A/B variant assignment (deterministic, no DB lookup) ──────────────────────

function assignVariant(fanProfileId, offerId) {
  const hash = crypto
    .createHash("sha256")
    .update(`${fanProfileId}:${offerId}`)
    .digest("hex");
  const bucket = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  return bucket < AB_SPLIT ? AB_VARIANTS[0] : AB_VARIANTS[1];
}

// ── Frequency cap check ───────────────────────────────────────────────────────

async function countRecentImpressions(tenantId, fanProfileId, offerId) {
  const since = new Date(Date.now() - FREQUENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return OfferImpression.countDocuments({
    tenantId,
    fanProfileId,
    offerId,
    shownAt: { $gte: since },
  });
}

// ── ML propensity boost ───────────────────────────────────────────────────────

function applyMlBoost(offers, mlScores) {
  if (!mlScores) return offers;
  return offers.map((o) => {
    let boost = 0;
    if (o.offerType === "discount_percent" && mlScores.retailPropensity > 0.6) boost -= 5;
    if (o.productHint?.toLowerCase().includes("ticket") && mlScores.ticketPropensity > 0.6) boost -= 5;
    if (mlScores.churnRiskScore > 0.7) boost -= 3; // show retention offers first
    return { ...o.toObject ? o.toObject() : o, _mlAdjustedPriority: (o.priority ?? 100) + boost };
  });
}

// ── Core: get top-N offers for a fan ─────────────────────────────────────────

export async function getTopNOffers(tenantId, fanProfileId, { channel = "fan_app", record = true } = {}) {
  const [segments, balance, traits, mlScores, offers] = await Promise.all([
    getFanSegments(tenantId, fanProfileId),
    getBalance(tenantId, fanProfileId),
    getFanTraits(tenantId, fanProfileId),
    getFanMlScores(tenantId, fanProfileId).catch(() => null),
    Offer.find({ tenantId, status: "active" }).sort({ priority: 1 }),
  ]);

  const now = new Date();
  const activeOffers = offers.filter((o) => {
    if (o.validFrom && o.validFrom > now) return false;
    if (o.validUntil && o.validUntil < now) return false;
    if ((o.minPoints ?? 0) > 0 && balance < o.minPoints) return false;
    return true;
  });

  const boosted = applyMlBoost(activeOffers, mlScores);
  const sorted = [...boosted].sort((a, b) => (a._mlAdjustedPriority ?? 100) - (b._mlAdjustedPriority ?? 100));

  const segmentIds = new Set(segments.map((s) => s._id.toString()));
  const segmentNames = new Set(segments.map((s) => s.name));

  // Score each offer
  const scored = [];
  for (const offer of sorted) {
    const impressionCount = await countRecentImpressions(tenantId, fanProfileId, offer._id); // eslint-disable-line no-await-in-loop
    if (impressionCount >= FREQUENCY_CAP) continue; // frequency-capped

    const matchByName = offer.segmentName && segmentNames.has(offer.segmentName);
    const matchById = offer.segmentId && segmentIds.has(offer.segmentId.toString());
    const isTargeted = matchByName || matchById;
    const isFallback = !offer.segmentId;

    scored.push({
      offer: offer.toJSON ? offer.toJSON() : offer,
      matchedSegment: isTargeted ? offer.segmentName : null,
      fallback: !isTargeted,
      isFallback,
      variant: assignVariant(fanProfileId.toString(), offer._id.toString()),
      impressionCount,
    });

    if (scored.length >= TOP_N) break;
  }

  // Record impressions (non-blocking)
  if (record && scored.length > 0) {
    const impressions = scored.map(({ offer, variant }) =>
      OfferImpression.create({
        tenantId,
        fanProfileId,
        offerId: offer.id ?? offer._id,
        variant,
        channel,
        shownAt: now,
      }).catch(() => {}),
    );
    Promise.allSettled(impressions);
  }

  return {
    offers: scored,
    fanContext: {
      balance,
      traits,
      segmentNames: [...segmentNames],
      mlScores,
    },
    totalActive: activeOffers.length,
  };
}

// ── Convenience: single best offer (v1-compatible) ───────────────────────────

export async function getNextBestOfferV2(tenantId, fanProfileId, opts) {
  const { offers, fanContext } = await getTopNOffers(tenantId, fanProfileId, opts);
  const best = offers[0] ?? null;
  return {
    offer: best?.offer ?? null,
    matchedSegment: best?.matchedSegment ?? null,
    fallback: best?.fallback ?? true,
    variant: best?.variant ?? null,
    fanContext,
  };
}

// ── Record conversion ─────────────────────────────────────────────────────────

export async function recordOfferConversion(tenantId, fanProfileId, offerId, { revenueCents = 0 } = {}) {
  const impression = await OfferImpression.findOne({
    tenantId,
    fanProfileId,
    offerId,
    converted: false,
  }).sort({ shownAt: -1 });

  if (!impression) return null;

  impression.converted = true;
  impression.clicked = true;
  impression.convertedAt = new Date();
  impression.attributedRevenueCents = revenueCents;
  await impression.save();
  return impression;
}

// ── A/B result analytics ──────────────────────────────────────────────────────

export async function getAbTestResults(tenantId, offerId) {
  const results = await OfferImpression.aggregate([
    { $match: { tenantId, offerId: { $toString: offerId } } },
    {
      $group: {
        _id: "$variant",
        impressions: { $sum: 1 },
        clicks: { $sum: { $cond: ["$clicked", 1, 0] } },
        conversions: { $sum: { $cond: ["$converted", 1, 0] } },
        revenueCents: { $sum: "$attributedRevenueCents" },
      },
    },
    {
      $project: {
        variant: "$_id",
        impressions: 1,
        clicks: 1,
        conversions: 1,
        revenueCents: 1,
        ctr: { $cond: [{ $gt: ["$impressions", 0] }, { $divide: ["$clicks", "$impressions"] }, 0] },
        cvr: { $cond: [{ $gt: ["$impressions", 0] }, { $divide: ["$conversions", "$impressions"] }, 0] },
        _id: 0,
      },
    },
    { $sort: { cvr: -1 } },
  ]);

  return results;
}
