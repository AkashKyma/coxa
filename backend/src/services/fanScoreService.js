/**
 * Fan Score Engine — computes the composite 0–100,000 Fan Score.
 *
 * Formula (weighted sum of normalised component scores):
 *   totalScore = round(
 *     attendanceScore  × 0.40 +
 *     tenureScore      × 0.20 +
 *     spendingScore    × 0.15 +
 *     referralScore    × 0.10 +
 *     engagementScore  × 0.10 +
 *     donationScore    × 0.05
 *   )
 *
 * Each component is normalised 0–100,000 before weighting so the composite
 * range stays within 0–100,000.
 */

import { FanScore } from "../models/FanScore.js";
import { FanScoreHistory } from "../models/FanScoreHistory.js";
import { FanTrait } from "../models/FanTrait.js";
import { FanMembership } from "../models/FanMembership.js";

// ── Tier thresholds (exported for routes / seed) ─────────────────────────────

export const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 5001,
  gold: 15001,
  platinum: 35001,
  diamond: 60001,
};

export function scoreToTier(score) {
  if (score >= TIER_THRESHOLDS.diamond) return "diamond";
  if (score >= TIER_THRESHOLDS.platinum) return "platinum";
  if (score >= TIER_THRESHOLDS.gold) return "gold";
  if (score >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function getTierThresholds() {
  return { ...TIER_THRESHOLDS };
}

// ── Component calculators ─────────────────────────────────────────────────────

/**
 * Attendance (40%).
 * Normalised out of 100,000 capped at 200 total matches attended.
 * No-shows and consecutive streaks are factored in.
 */
function computeAttendanceScore(traits) {
  const attended = Number(traits.match_attendance_count ?? 0);
  const noShows = Number(traits.no_show_count ?? 0);
  const consecutive = Number(traits.consecutive_match_count ?? 0);

  // Attendance ratio bonus: reward high show-up rate
  const total = attended + noShows;
  const attendanceRate = total > 0 ? attended / total : 0;

  // Base: 300 pts per match attended, cap 200 matches = 60,000 base
  const base = Math.min(attended * 300, 60_000);

  // Streak bonus: up to 10,000 for 20+ consecutive
  const streakBonus = Math.min(consecutive * 500, 10_000);

  // Attendance rate bonus: up to 30,000 if 100% rate
  const rateBonus = Math.round(attendanceRate * 30_000);

  return Math.min(base + streakBonus + rateBonus, 100_000);
}

/**
 * Tenure (20%).
 * Normalised out of 100,000 capped at 10 years active membership.
 * Annual payment gives a 20% bonus.
 */
function computeTenureScore(traits, membership) {
  const months = Number(traits.months_as_member ?? 0);
  const isAnnual = traits.is_annual_member === true;

  // 833 pts per month × 12 months × 10 years = 100,000 at 10 year cap
  const base = Math.min(months * 833, 100_000);

  // Annual payment loyalty bonus: +20%
  const annualBonus = isAnnual ? Math.round(base * 0.2) : 0;

  return Math.min(base + annualBonus, 100_000);
}

/**
 * Spending (15%).
 * R$10,000 lifetime spend → 100,000 score.
 */
function computeSpendingScore(traits) {
  const retailCents = Number(traits.total_retail_spend_cents ?? 0);
  const ticketCount = Number(traits.ticket_purchase_count ?? 0);
  // Estimate average R$80 per ticket purchase in cents
  const ticketCents = ticketCount * 8_000;
  const totalCents = retailCents + ticketCents;

  // R$100 = 100 cents × 100 = 10,000 cents → score 1,000
  // Cap at R$10,000 (1,000,000 cents) → score 100,000
  return Math.min(Math.round(totalCents / 10), 100_000);
}

/**
 * Referrals (10%).
 * 10,000 per confirmed referral, cap 10 referrals.
 */
function computeReferralScore(traits) {
  const confirmed = Number(traits.referral_count ?? 0);
  return Math.min(confirmed * 10_000, 100_000);
}

/**
 * Engagement (10%).
 * Campaigns + community events, 5,000 per participation, cap 20.
 */
function computeEngagementScore(traits) {
  const campaigns = Number(traits.campaign_count ?? 0);
  return Math.min(campaigns * 5_000, 100_000);
}

/**
 * Donations (5%).
 * R$1,000 = 100,000 score.
 */
function computeDonationScore(traits) {
  const donationCents = Number(traits.total_donation_cents ?? 0);
  return Math.min(Math.round(donationCents / 10), 100_000);
}

// ── Main scoring function ─────────────────────────────────────────────────────

export async function recalculateFanScore(tenantId, fanProfileId) {
  const [traitDocs, membership] = await Promise.all([
    FanTrait.find({ tenantId, fanProfileId }),
    FanMembership.findOne({ tenantId, fanProfileId, status: "active" }),
  ]);

  const traits = Object.fromEntries(traitDocs.map((t) => [t.traitKey, t.value]));

  const attendanceScore = computeAttendanceScore(traits);
  const tenureScore = computeTenureScore(traits, membership);
  const spendingScore = computeSpendingScore(traits);
  const referralScore = computeReferralScore(traits);
  const engagementScore = computeEngagementScore(traits);
  const donationScore = computeDonationScore(traits);

  const totalScore = Math.round(
    attendanceScore * 0.40 +
    tenureScore     * 0.20 +
    spendingScore   * 0.15 +
    referralScore   * 0.10 +
    engagementScore * 0.10 +
    donationScore   * 0.05,
  );

  const tier = scoreToTier(totalScore);

  const components = {
    attendanceScore,
    tenureScore,
    spendingScore,
    referralScore,
    engagementScore,
    donationScore,
  };

  // Upsert FanScore document
  const existing = await FanScore.findOne({ tenantId, fanProfileId });
  const previousScore = existing?.totalScore ?? 0;
  const previousTier = existing?.tier ?? "bronze";

  const updated = await FanScore.findOneAndUpdate(
    { tenantId, fanProfileId },
    {
      $set: {
        totalScore,
        tier,
        ...components,
        lastCalculatedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    { upsert: true, new: true },
  );

  // Append history entry when score actually changed
  if (previousScore !== totalScore) {
    await FanScoreHistory.create({
      tenantId,
      fanProfileId,
      previousScore,
      newScore: totalScore,
      delta: totalScore - previousScore,
      previousTier,
      newTier: tier,
      reason: "recalculation",
      calculatedAt: new Date(),
      components,
    });
  }

  return updated;
}

export async function getScoreBreakdown(tenantId, fanProfileId) {
  const [score, history] = await Promise.all([
    FanScore.findOne({ tenantId, fanProfileId }),
    FanScoreHistory.find({ tenantId, fanProfileId })
      .sort({ calculatedAt: -1 })
      .limit(10),
  ]);

  return {
    score: score ?? {
      totalScore: 0,
      tier: "bronze",
      attendanceScore: 0,
      tenureScore: 0,
      spendingScore: 0,
      referralScore: 0,
      engagementScore: 0,
      donationScore: 0,
    },
    history,
    tierThresholds: TIER_THRESHOLDS,
  };
}

export async function initFanScore(tenantId, fanProfileId) {
  const existing = await FanScore.findOne({ tenantId, fanProfileId });
  if (existing) return existing;
  return FanScore.create({
    tenantId,
    fanProfileId,
    totalScore: 0,
    tier: "bronze",
    attendanceScore: 0,
    tenureScore: 0,
    spendingScore: 0,
    referralScore: 0,
    engagementScore: 0,
    donationScore: 0,
    lastCalculatedAt: new Date(),
  });
}
