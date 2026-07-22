import { FanTrait } from "../models/FanTrait.js";
import { FanMembership } from "../models/FanMembership.js";
import { Referral } from "../models/Referral.js";
import { CampaignParticipation } from "../models/CampaignParticipation.js";
import { Sale } from "../models/Sale.js";
import { MembershipTransaction } from "../models/MembershipTransaction.js";
import { refreshSegmentMemberCounts } from "./segmentService.js";

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;

async function upsertTrait(tenantId, fanProfileId, traitKey, value) {
  return FanTrait.findOneAndUpdate(
    { tenantId, fanProfileId, traitKey },
    { value, computedAt: new Date() },
    { upsert: true, new: true },
  );
}

async function incrementNumericTrait(tenantId, fanProfileId, traitKey, delta) {
  const existing = await FanTrait.findOne({ tenantId, fanProfileId, traitKey });
  const current = Number(existing?.value ?? 0);
  return upsertTrait(tenantId, fanProfileId, traitKey, current + delta);
}

export async function handleTraitUpdate(event) {
  if (!event.fanProfileId) return;

  const { tenantId, fanProfileId, eventName, payload, eventTimestamp } = event;

  if (eventName === "sale.completed") {
    const totalCents = Number(payload.totalCents ?? 0);
    await incrementNumericTrait(tenantId, fanProfileId, "retail_purchase_count", 1);
    await incrementNumericTrait(tenantId, fanProfileId, "total_retail_spend_cents", totalCents);
    await upsertTrait(tenantId, fanProfileId, "last_purchase_at", eventTimestamp);

    const lastPurchase = new Date(eventTimestamp).getTime();
    await upsertTrait(
      tenantId,
      fanProfileId,
      "is_recent_buyer",
      Date.now() - lastPurchase <= MS_30_DAYS,
    );
  }

  if (eventName === "fan.registered") {
    await upsertTrait(tenantId, fanProfileId, "fan_since", eventTimestamp);
    await upsertTrait(tenantId, fanProfileId, "retail_purchase_count", 0);
    await upsertTrait(tenantId, fanProfileId, "total_retail_spend_cents", 0);
    await upsertTrait(tenantId, fanProfileId, "is_recent_buyer", false);
    await upsertTrait(tenantId, fanProfileId, "is_inactive", false);
    await upsertTrait(tenantId, fanProfileId, "ticket_purchase_count", 0);
    await upsertTrait(tenantId, fanProfileId, "match_attendance_count", 0);
    await upsertTrait(tenantId, fanProfileId, "consecutive_match_count", 0);
    await upsertTrait(tenantId, fanProfileId, "referral_count", 0);
    await upsertTrait(tenantId, fanProfileId, "campaign_count", 0);
  }

  if (
    eventName === "membership.created" ||
    eventName === "membership.renewed" ||
    eventName === "membership.upgraded"
  ) {
    const freq = payload?.paymentFrequency;
    if (freq) {
      await upsertTrait(tenantId, fanProfileId, "is_annual_member", freq === "annual");
    }
    if (payload?.planCode) {
      await upsertTrait(tenantId, fanProfileId, "membership_plan_code", payload.planCode);
    }
    const membershipSpend = Number(payload?.amountCents ?? 0);
    if (membershipSpend > 0) {
      await incrementNumericTrait(tenantId, fanProfileId, "total_retail_spend_cents", membershipSpend);
    }
    // Recompute months_as_member from the FanMembership document
    const membership = await FanMembership.findOne({ tenantId, fanProfileId, status: "active" });
    if (membership) {
      const months = Math.floor(
        (Date.now() - new Date(membership.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30),
      );
      await upsertTrait(tenantId, fanProfileId, "months_as_member", months);
    }
  }

  if (eventName === "referral.confirmed") {
    await incrementNumericTrait(tenantId, fanProfileId, "referral_count", 1);
  }

  if (eventName === "campaign.participated") {
    await incrementNumericTrait(tenantId, fanProfileId, "campaign_count", 1);
    if (payload?.participationType === "donation" && payload?.amountCents) {
      await incrementNumericTrait(
        tenantId,
        fanProfileId,
        "total_donation_cents",
        Number(payload.amountCents),
      );
    }
  }

  if (eventName === "ticket.purchased") {
    const ticketCount = Number(payload.ticketCount ?? 1);
    await incrementNumericTrait(tenantId, fanProfileId, "ticket_purchase_count", ticketCount);
    await upsertTrait(tenantId, fanProfileId, "last_ticket_purchase_at", eventTimestamp);
  }

  if (eventName === "ticket.used" || eventName === "member.checked_in") {
    await incrementNumericTrait(tenantId, fanProfileId, "match_attendance_count", 1);
    await upsertTrait(tenantId, fanProfileId, "last_attendance_at", eventTimestamp);

    // Consecutive match streak tracking
    const prevConsecutive = Number(
      (await FanTrait.findOne({ tenantId, fanProfileId, traitKey: "consecutive_match_count" }))?.value ?? 0,
    );
    await upsertTrait(tenantId, fanProfileId, "consecutive_match_count", prevConsecutive + 1);
  }

  if (eventName === "no_show.recorded") {
    await incrementNumericTrait(tenantId, fanProfileId, "no_show_count", 1);
    // Reset consecutive streak on no-show
    await upsertTrait(tenantId, fanProfileId, "consecutive_match_count", 0);
  }

  await recomputeDerivedTraits(tenantId, fanProfileId);
  await refreshSegmentMemberCounts(tenantId);
}

export async function recomputeDerivedTraits(tenantId, fanProfileId) {
  const traits = await FanTrait.find({ tenantId, fanProfileId });
  const map = Object.fromEntries(traits.map((t) => [t.traitKey, t.value]));

  // Sync lifetime spend from sales + membership payments (source of truth)
  const [saleAgg, membershipAgg] = await Promise.all([
    Sale.aggregate([
      { $match: { tenantId, fanProfileId, status: "completed" } },
      { $group: { _id: null, totalCents: { $sum: "$totalCents" } } },
    ]),
    MembershipTransaction.aggregate([
      { $match: { tenantId, fanProfileId, status: "completed" } },
      { $group: { _id: null, totalCents: { $sum: "$amountCents" } } },
    ]),
  ]);
  const lifetimeSpendCents =
    Number(saleAgg[0]?.totalCents ?? 0) + Number(membershipAgg[0]?.totalCents ?? 0);
  if (lifetimeSpendCents > 0) {
    await upsertTrait(tenantId, fanProfileId, "total_retail_spend_cents", lifetimeSpendCents);
    map.total_retail_spend_cents = lifetimeSpendCents;
  }

  const totalSpend = Number(map.total_retail_spend_cents ?? 0);
  await upsertTrait(tenantId, fanProfileId, "is_high_value_retail", totalSpend >= 50000);

  const lastPurchaseAt = map.last_purchase_at ? new Date(map.last_purchase_at).getTime() : null;
  const inactive =
    !lastPurchaseAt || Date.now() - lastPurchaseAt > MS_90_DAYS;
  await upsertTrait(tenantId, fanProfileId, "is_inactive", inactive);

  // Keep months_as_member fresh every time traits are recomputed
  const membership = await FanMembership.findOne({ tenantId, fanProfileId, status: "active" });
  if (membership) {
    const months = Math.floor(
      (Date.now() - new Date(membership.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30),
    );
    await upsertTrait(tenantId, fanProfileId, "months_as_member", months);
    await upsertTrait(tenantId, fanProfileId, "is_annual_member", membership.paymentFrequency === "annual");
    await upsertTrait(tenantId, fanProfileId, "membership_plan_code", membership.planCode);
  }

  // Sync referral count from DB (source of truth)
  const confirmedReferrals = await Referral.countDocuments({
    tenantId,
    referrerFanProfileId: fanProfileId,
    status: { $in: ["confirmed", "rewarded"] },
  });
  await upsertTrait(tenantId, fanProfileId, "referral_count", confirmedReferrals);

  // Sync campaign count
  const campaignCount = await CampaignParticipation.countDocuments({ tenantId, fanProfileId });
  await upsertTrait(tenantId, fanProfileId, "campaign_count", campaignCount);
}

export async function getFanTraits(tenantId, fanProfileId) {
  const traits = await FanTrait.find({ tenantId, fanProfileId }).sort({ traitKey: 1 });
  return Object.fromEntries(traits.map((t) => [t.traitKey, t.value]));
}

export async function getAllFanTraitsMap(tenantId) {
  const traits = await FanTrait.find({ tenantId });
  const byFan = new Map();
  for (const trait of traits) {
    const key = trait.fanProfileId.toString();
    if (!byFan.has(key)) byFan.set(key, {});
    byFan.get(key)[trait.traitKey] = trait.value;
  }
  return byFan;
}
