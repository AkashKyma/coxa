import { LoyaltyRule } from "../models/LoyaltyRule.js";
import { LoyaltyReward } from "../models/LoyaltyReward.js";
import { LoyaltyLedgerEntry } from "../models/LoyaltyLedgerEntry.js";
import { Sale } from "../models/Sale.js";
import { publishEvent } from "./cdp/cdpEventService.js";

async function recordLoyaltyAuditEvent({ tenantId, fanProfileId, eventName, idempotencyKey, payload }) {
  try {
    const result = await publishEvent({
      tenantId,
      eventName,
      source: "loyalty_service",
      fanProfileId,
      idempotencyKey,
      payload,
    });
    return result.event;
  } catch (err) {
    if (err.code === "DUPLICATE_EVENT") return null;
    throw err;
  }
}

export async function getBalance(tenantId, fanProfileId) {
  if (!fanProfileId) return 0;
  const latest = await LoyaltyLedgerEntry.findOne({ tenantId, fanProfileId }).sort({ createdAt: -1 });
  return latest?.balanceAfter ?? 0;
}

export async function getBalanceSummary(tenantId, fanProfileId) {
  const entries = await LoyaltyLedgerEntry.find({ tenantId, fanProfileId });
  let lifetimeEarned = 0;
  let lifetimeRedeemed = 0;
  let lifetimeReversed = 0;
  let lifetimeAdjusted = 0;

  for (const e of entries) {
    if (e.pointsDelta > 0) {
      if (e.entryType === "earn" || e.entryType === "adjust") lifetimeEarned += e.pointsDelta;
    } else if (e.pointsDelta < 0) {
      if (e.entryType === "redeem") lifetimeRedeemed += Math.abs(e.pointsDelta);
      else if (e.entryType === "reverse" || e.entryType === "expire") lifetimeReversed += Math.abs(e.pointsDelta);
      else if (e.entryType === "adjust") lifetimeRedeemed += Math.abs(e.pointsDelta);
    }
  }

  const balance = await getBalance(tenantId, fanProfileId);
  return {
    balance,
    lifetimeEarned,
    lifetimeRedeemed,
    lifetimeReversed,
    lifetimeAdjusted,
    entryCount: entries.length,
  };
}

export async function getLedger(tenantId, fanProfileId, limit = 50) {
  return LoyaltyLedgerEntry.find({ tenantId, fanProfileId })
    .sort({ createdAt: -1 })
    .limit(limit);
}

async function appendLedgerEntry({
  tenantId,
  fanProfileId,
  entryType,
  pointsDelta,
  referenceType,
  referenceId,
  idempotencyKey,
  note,
  createdBy,
}) {
  const existing = await LoyaltyLedgerEntry.findOne({ tenantId, idempotencyKey });
  if (existing) return existing;

  const currentBalance = await getBalance(tenantId, fanProfileId);
  const newBalance = currentBalance + pointsDelta;

  if (newBalance < 0) {
    const err = new Error("Insufficient points balance");
    err.status = 400;
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }

  return LoyaltyLedgerEntry.create({
    tenantId,
    fanProfileId,
    entryType,
    pointsDelta,
    balanceAfter: newBalance,
    referenceType,
    referenceId,
    idempotencyKey,
    note,
    createdBy,
  });
}

export async function earnPoints({
  tenantId,
  fanProfileId,
  points,
  referenceType,
  referenceId,
  idempotencyKey,
  note,
  createdBy,
}) {
  if (points <= 0) return null;

  const entry = await appendLedgerEntry({
    tenantId,
    fanProfileId,
    entryType: "earn",
    pointsDelta: points,
    referenceType,
    referenceId,
    idempotencyKey,
    note,
    createdBy,
  });

  await recordLoyaltyAuditEvent({
    tenantId,
    fanProfileId,
    eventName: "loyalty.points.earned",
    idempotencyKey: `loyalty-event-${idempotencyKey}`,
    payload: { points, referenceType, referenceId, balanceAfter: entry.balanceAfter },
  });

  return entry;
}

export async function reversePoints({
  tenantId,
  fanProfileId,
  points,
  referenceType,
  referenceId,
  idempotencyKey,
  note,
  createdBy = "system",
}) {
  if (points <= 0) return null;

  const entry = await appendLedgerEntry({
    tenantId,
    fanProfileId,
    entryType: "reverse",
    pointsDelta: -points,
    referenceType,
    referenceId,
    idempotencyKey,
    note,
    createdBy,
  });

  await recordLoyaltyAuditEvent({
    tenantId,
    fanProfileId,
    eventName: "loyalty.points.reversed",
    idempotencyKey: `loyalty-reverse-event-${idempotencyKey}`,
    payload: { points, referenceType, referenceId, balanceAfter: entry.balanceAfter },
  });

  return entry;
}

export async function adjustPoints({
  tenantId,
  fanProfileId,
  pointsDelta,
  note,
  createdBy,
  idempotencyKey,
}) {
  const entry = await appendLedgerEntry({
    tenantId,
    fanProfileId,
    entryType: "adjust",
    pointsDelta,
    referenceType: "manual_adjustment",
    referenceId: idempotencyKey,
    idempotencyKey,
    note,
    createdBy,
  });

  await recordLoyaltyAuditEvent({
    tenantId,
    fanProfileId,
    eventName: "loyalty.points.adjusted",
    idempotencyKey: `loyalty-adjust-event-${idempotencyKey}`,
    payload: { pointsDelta, note, balanceAfter: entry.balanceAfter },
  });

  return entry;
}

export async function redeemPoints({
  tenantId,
  fanProfileId,
  points,
  referenceType,
  referenceId,
  idempotencyKey,
  note,
}) {
  if (points <= 0) {
    const err = new Error("Redeem points must be positive");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const entry = await appendLedgerEntry({
    tenantId,
    fanProfileId,
    entryType: "redeem",
    pointsDelta: -points,
    referenceType,
    referenceId,
    idempotencyKey,
    note,
  });

  await recordLoyaltyAuditEvent({
    tenantId,
    fanProfileId,
    eventName: "loyalty.points.redeemed",
    idempotencyKey: `loyalty-redeem-event-${idempotencyKey}`,
    payload: { points, referenceType, referenceId, balanceAfter: entry.balanceAfter },
  });

  return entry;
}

function rewardIsAvailable(reward, now = new Date()) {
  if (reward.status !== "active") return false;
  if (reward.validFrom && reward.validFrom > now) return false;
  if (reward.validUntil && reward.validUntil < now) return false;
  if (reward.inventoryLimit != null && reward.redeemedCount >= reward.inventoryLimit) return false;
  return true;
}

export async function listRewards(tenantId, { status, forFan = false } = {}) {
  const filter = { tenantId };
  if (status) filter.status = status;
  const rewards = await LoyaltyReward.find(filter).sort({ pointsCost: 1, name: 1 });
  if (!forFan) return rewards;
  return rewards.filter((r) => rewardIsAvailable(r));
}

export async function upsertReward(tenantId, rewardData) {
  if (rewardData.id) {
    const reward = await LoyaltyReward.findOne({ _id: rewardData.id, tenantId });
    if (!reward) {
      const err = new Error("Reward not found");
      err.status = 404;
      err.code = "REWARD_NOT_FOUND";
      throw err;
    }
    const { id, ...updates } = rewardData;
    Object.assign(reward, updates);
    await reward.save();
    return reward;
  }
  return LoyaltyReward.create({ tenantId, ...rewardData });
}

export async function redeemReward({
  tenantId,
  fanProfileId,
  rewardId,
  idempotencyKey,
  createdBy = "system",
}) {
  const reward = await LoyaltyReward.findOne({ _id: rewardId, tenantId });
  if (!reward) {
    const err = new Error("Reward not found");
    err.status = 404;
    err.code = "REWARD_NOT_FOUND";
    throw err;
  }
  if (!rewardIsAvailable(reward)) {
    const err = new Error("Reward is not available");
    err.status = 400;
    err.code = "REWARD_UNAVAILABLE";
    throw err;
  }

  const balance = await getBalance(tenantId, fanProfileId);
  if (balance < reward.pointsCost) {
    const err = new Error("Insufficient points for this reward");
    err.status = 400;
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }

  const key = idempotencyKey ?? `redeem-reward-${rewardId}-${fanProfileId}-${Date.now()}`;
  const entry = await redeemPoints({
    tenantId,
    fanProfileId,
    points: reward.pointsCost,
    referenceType: "reward",
    referenceId: reward._id.toString(),
    idempotencyKey: key,
    note: `Redeemed: ${reward.name}`,
  });

  reward.redeemedCount += 1;
  await reward.save();

  await recordLoyaltyAuditEvent({
    tenantId,
    fanProfileId,
    eventName: "loyalty.reward.redeemed",
    idempotencyKey: `loyalty-reward-event-${key}`,
    payload: {
      rewardId: reward.id,
      rewardCode: reward.code,
      rewardName: reward.name,
      pointsCost: reward.pointsCost,
      balanceAfter: entry.balanceAfter,
    },
  });

  return { entry, reward };
}

async function reverseSaleEarn(event) {
  const saleId = event.payload?.saleId;
  const returnTotalCents = Number(event.payload?.totalCents ?? 0);
  if (!saleId || returnTotalCents <= 0) return;

  const originalEarn = await LoyaltyLedgerEntry.findOne({
    tenantId: event.tenantId,
    fanProfileId: event.fanProfileId,
    entryType: "earn",
    referenceType: "sale",
    referenceId: saleId,
  });
  if (!originalEarn) return;

  const sale = await Sale.findById(saleId);
  const saleTotal = sale?.totalCents ?? originalEarn.pointsDelta * 100;
  const pointsToReverse =
    saleTotal > 0
      ? Math.min(
          originalEarn.pointsDelta,
          Math.floor((returnTotalCents / saleTotal) * originalEarn.pointsDelta),
        )
      : originalEarn.pointsDelta;

  if (pointsToReverse <= 0) return;

  await reversePoints({
    tenantId: event.tenantId,
    fanProfileId: event.fanProfileId,
    points: pointsToReverse,
    referenceType: "return",
    referenceId: event.payload.returnId ?? event._id.toString(),
    idempotencyKey: `reverse-return-${event.idempotencyKey}`,
    note: `Points reversed for return ${event.payload.returnNumber ?? ""}`.trim(),
  });
}

export async function handleLoyaltyEvent(event) {
  if (!event.fanProfileId) return;

  if (event.eventName === "sale.returned") {
    await reverseSaleEarn(event);
    return;
  }

  if (event.eventName === "ticket.purchased") {
    const rule = await LoyaltyRule.findOne({
      tenantId: event.tenantId,
      ruleType: "earn_ticket",
      status: "active",
    });
    if (!rule) return;

    const totalCents = Number(event.payload.totalCents ?? 0);
    if (totalCents < (rule.minAmountCents ?? 0)) return;

    const points = Math.floor((totalCents / 100) * (rule.pointsPerReal ?? 1));
    if (points <= 0) return;

    await earnPoints({
      tenantId: event.tenantId,
      fanProfileId: event.fanProfileId,
      points,
      referenceType: "ticket",
      referenceId: event.payload.ticketIds?.[0] ?? event._id.toString(),
      idempotencyKey: `earn-ticket-${event.idempotencyKey}`,
      note: `Earned from ticket purchase: ${event.payload.eventTitle ?? "event"}`,
      createdBy: "system",
    });
    return;
  }

  if (event.eventName === "member.checked_in") {
    const ruleType = event.payload?.isAwayMatch ? "earn_away_match" : "earn_attendance";
    const rule = await LoyaltyRule.findOne({
      tenantId: event.tenantId,
      ruleType,
      status: "active",
    }) ?? await LoyaltyRule.findOne({
      tenantId: event.tenantId,
      ruleType: "earn_attendance",
      status: "active",
    });
    if (!rule) return;

    const points = rule.pointsFlat ?? rule.pointsPerReal ?? 50;
    await earnPoints({
      tenantId: event.tenantId,
      fanProfileId: event.fanProfileId,
      points,
      referenceType: "check_in",
      referenceId: event.payload.entitlementId ?? event._id.toString(),
      idempotencyKey: `earn-checkin-${event.idempotencyKey}`,
      note: event.payload?.isAwayMatch ? "Away match attendance bonus" : "Member check-in bonus",
      createdBy: "system",
    });
    return;
  }

  if (event.eventName === "membership.renewed" && event.payload?.paymentFrequency === "annual") {
    const rule = await LoyaltyRule.findOne({
      tenantId: event.tenantId,
      ruleType: "earn_annual_renewal",
      status: "active",
    });
    if (!rule) return;
    const points = rule.pointsFlat ?? rule.pointsPerReal ?? 2000;
    await earnPoints({
      tenantId: event.tenantId,
      fanProfileId: event.fanProfileId,
      points,
      referenceType: "membership_renewal",
      referenceId: event.payload.membershipId ?? event._id.toString(),
      idempotencyKey: `earn-renewal-${event.idempotencyKey}`,
      note: "Annual membership renewal bonus",
      createdBy: "system",
    });
    return;
  }

  if (event.eventName === "membership.created" && event.payload?.paymentFrequency === "annual") {
    const rule = await LoyaltyRule.findOne({
      tenantId: event.tenantId,
      ruleType: "earn_annual_renewal",
      status: "active",
    });
    if (!rule) return;
    const points = rule.pointsFlat ?? rule.pointsPerReal ?? 2000;
    await earnPoints({
      tenantId: event.tenantId,
      fanProfileId: event.fanProfileId,
      points,
      referenceType: "membership_new",
      referenceId: event.payload.membershipId ?? event._id.toString(),
      idempotencyKey: `earn-new-membership-${event.idempotencyKey}`,
      note: "Annual membership sign-up bonus",
      createdBy: "system",
    });
    return;
  }

  if (event.eventName === "referral.confirmed") {
    const rule = await LoyaltyRule.findOne({
      tenantId: event.tenantId,
      ruleType: "earn_referral",
      status: "active",
    });
    if (!rule) return;
    const points = rule.pointsFlat ?? rule.pointsPerReal ?? 1000;
    await earnPoints({
      tenantId: event.tenantId,
      fanProfileId: event.fanProfileId,
      points,
      referenceType: "referral",
      referenceId: event.payload.referralId ?? event._id.toString(),
      idempotencyKey: `earn-referral-${event.idempotencyKey}`,
      note: `Referral bonus — code ${event.payload.referralCode ?? ""}`.trim(),
      createdBy: "system",
    });
    return;
  }

  if (event.eventName === "campaign.participated") {
    const ruleType =
      event.payload?.participationType === "donation"
        ? "earn_donation"
        : "earn_community_event";
    const rule = await LoyaltyRule.findOne({
      tenantId: event.tenantId,
      ruleType,
      status: "active",
    });
    if (!rule) return;

    let points;
    if (ruleType === "earn_donation") {
      const amountCents = Number(event.payload?.amountCents ?? 0);
      points = amountCents > 0
        ? Math.max(500, Math.floor(amountCents / 100))
        : (rule.pointsFlat ?? rule.pointsPerReal ?? 500);
    } else {
      points = rule.pointsFlat ?? rule.pointsPerReal ?? 250;
    }

    await earnPoints({
      tenantId: event.tenantId,
      fanProfileId: event.fanProfileId,
      points,
      referenceType: "campaign",
      referenceId: event.payload.campaignId ?? event._id.toString(),
      idempotencyKey: `earn-campaign-${event.idempotencyKey}`,
      note: `Campaign: ${event.payload.campaignName ?? ""}`.trim(),
      createdBy: "system",
    });
    return;
  }

  if (event.eventName !== "sale.completed") return;

  const channel = event.payload?.channel ?? "pos";
  const ruleType =
    channel === "fan_shop"
      ? "earn_fan_shop"
      : channel === "fnb"
      ? "earn_fnb"
      : channel === "merchandise"
      ? "earn_merchandise"
      : "earn_retail";

  const rule = await LoyaltyRule.findOne({
    tenantId: event.tenantId,
    ruleType,
    status: "active",
  });
  if (!rule) return;

  const totalCents = Number(event.payload.totalCents ?? 0);
  if (totalCents < (rule.minAmountCents ?? 0)) return;

  const points = Math.floor((totalCents / 100) * (rule.pointsPerReal ?? 1));
  if (points <= 0) return;

  await earnPoints({
    tenantId: event.tenantId,
    fanProfileId: event.fanProfileId,
    points,
    referenceType: "sale",
    referenceId: event.payload.saleId ?? event._id.toString(),
    idempotencyKey: `earn-sale-${event.idempotencyKey}`,
    note: `Earned from ${event.payload.saleNumber ?? "sale"}`,
    createdBy: "system",
  });
}

export async function listRules(tenantId, { activeOnly = false } = {}) {
  const filter = { tenantId };
  if (activeOnly) filter.status = "active";
  return LoyaltyRule.find(filter).sort({ ruleType: 1 });
}

export async function upsertRule(tenantId, ruleData) {
  if (ruleData.id) {
    const rule = await LoyaltyRule.findOne({ _id: ruleData.id, tenantId });
    if (!rule) {
      const err = new Error("Rule not found");
      err.status = 404;
      err.code = "RULE_NOT_FOUND";
      throw err;
    }
    const { id, ...updates } = ruleData;
    Object.assign(rule, updates);
    await rule.save();
    return rule;
  }
  return LoyaltyRule.create({ tenantId, ...ruleData });
}

export function formatRuleForFan(rule) {
  const flatPointRules = new Set([
    "earn_attendance",
    "earn_away_match",
    "earn_annual_renewal",
    "earn_community_event",
    "earn_referral",
    "earn_donation",
  ]);
  if (flatPointRules.has(rule.ruleType)) {
    const pts = rule.pointsFlat ?? rule.pointsPerReal ?? 50;
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      earnLabel: `${pts} points per action`,
    };
  }
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    earnLabel: `${rule.pointsPerReal ?? 1} point${rule.pointsPerReal !== 1 ? "s" : ""} per R$1 spent`,
    minSpendBrl: (rule.minAmountCents ?? 0) / 100,
  };
}
