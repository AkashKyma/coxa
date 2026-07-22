import { FanMembership } from "../models/FanMembership.js";
import { FanProfile } from "../models/FanProfile.js";
import { MembershipPlan } from "../models/MembershipPlan.js";
import { MembershipTransaction } from "../models/MembershipTransaction.js";
import { FanScore } from "../models/FanScore.js";
import { publishEvent } from "./cdp/cdpEventService.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcRenewalDate(from, frequency) {
  const d = new Date(from);
  if (frequency === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function memberNumber(count) {
  return `SOCIO-${String(count).padStart(6, "0")}`;
}

async function nextMemberNumber(tenantId) {
  const count = await FanMembership.countDocuments({ tenantId });
  return memberNumber(count + 1);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createMembership({
  tenantId,
  fanProfileId,
  planCode,
  paymentFrequency = "monthly",
  paymentMethod = "stub",
  idempotencyKey,
}) {
  const profile = await FanProfile.findOne({ _id: fanProfileId, tenantId, status: "active" });
  if (!profile) {
    const err = new Error("Fan profile not found");
    err.status = 404;
    err.code = "FAN_NOT_FOUND";
    throw err;
  }

  const plan = await MembershipPlan.findOne({ tenantId, planCode, status: "active" });
  if (!plan) {
    const err = new Error(`Membership plan '${planCode}' not found`);
    err.status = 404;
    err.code = "PLAN_NOT_FOUND";
    throw err;
  }

  // Deactivate any existing active membership before creating new one
  await FanMembership.updateMany(
    { tenantId, fanProfileId, status: "active" },
    { $set: { status: "cancelled", cancelledAt: new Date() } },
  );

  const joinDate = new Date();
  const renewalDate = calcRenewalDate(joinDate, paymentFrequency);
  const mNumber = await nextMemberNumber(tenantId);
  const amountCents =
    paymentFrequency === "annual" ? (plan.annualPriceCents ?? 0) : (plan.monthlyPriceCents ?? 0);

  const membership = await FanMembership.create({
    tenantId,
    fanProfileId,
    planId: plan._id,
    planCode,
    status: "active",
    paymentFrequency,
    joinDate,
    renewalDate,
    autoRenew: true,
    memberNumber: mNumber,
  });

  const ikey = idempotencyKey ?? `membership-new-${fanProfileId}-${Date.now()}`;
  await MembershipTransaction.create({
    tenantId,
    fanProfileId,
    membershipId: membership._id,
    transactionType: "new",
    planCode,
    amountCents,
    paymentMethod,
    paymentFrequency,
    status: "completed",
    periodStart: joinDate,
    periodEnd: renewalDate,
    idempotencyKey: ikey,
  });

  await publishEvent({
    tenantId,
    eventName: "membership.created",
    source: "membership_service",
    fanProfileId,
    idempotencyKey: `evt-${ikey}`,
    payload: {
      membershipId: membership._id.toString(),
      planCode,
      paymentFrequency,
      memberNumber: mNumber,
      amountCents,
    },
  });

  return membership;
}

export async function renewMembership({
  tenantId,
  membershipId,
  paymentFrequency,
  paymentMethod = "stub",
  idempotencyKey,
}) {
  const membership = await FanMembership.findOne({ _id: membershipId, tenantId });
  if (!membership) {
    const err = new Error("Membership not found");
    err.status = 404;
    err.code = "MEMBERSHIP_NOT_FOUND";
    throw err;
  }

  const freq = paymentFrequency ?? membership.paymentFrequency;
  const from = membership.renewalDate > new Date() ? membership.renewalDate : new Date();
  membership.renewalDate = calcRenewalDate(from, freq);
  membership.paymentFrequency = freq;
  membership.status = "active";
  await membership.save();

  const plan = await MembershipPlan.findOne({ _id: membership.planId, tenantId });
  const amountCents =
    freq === "annual" ? (plan?.annualPriceCents ?? 0) : (plan?.monthlyPriceCents ?? 0);

  const ikey = idempotencyKey ?? `membership-renew-${membershipId}-${Date.now()}`;
  await MembershipTransaction.create({
    tenantId,
    fanProfileId: membership.fanProfileId,
    membershipId: membership._id,
    transactionType: "renewal",
    planCode: membership.planCode,
    amountCents,
    paymentMethod,
    paymentFrequency: freq,
    status: "completed",
    periodStart: from,
    periodEnd: membership.renewalDate,
    idempotencyKey: ikey,
  });

  await publishEvent({
    tenantId,
    eventName: "membership.renewed",
    source: "membership_service",
    fanProfileId: membership.fanProfileId,
    idempotencyKey: `evt-${ikey}`,
    payload: {
      membershipId: membership._id.toString(),
      planCode: membership.planCode,
      paymentFrequency: freq,
      renewalDate: membership.renewalDate,
      amountCents,
    },
  });

  return membership;
}

export async function upgradeMembership({
  tenantId,
  membershipId,
  newPlanCode,
  paymentFrequency,
  paymentMethod = "stub",
  idempotencyKey,
}) {
  const membership = await FanMembership.findOne({ _id: membershipId, tenantId, status: "active" });
  if (!membership) {
    const err = new Error("Active membership not found");
    err.status = 404;
    err.code = "MEMBERSHIP_NOT_FOUND";
    throw err;
  }

  const newPlan = await MembershipPlan.findOne({ tenantId, planCode: newPlanCode, status: "active" });
  if (!newPlan) {
    const err = new Error(`Plan '${newPlanCode}' not found`);
    err.status = 404;
    err.code = "PLAN_NOT_FOUND";
    throw err;
  }

  const oldCode = membership.planCode;
  const freq = paymentFrequency ?? membership.paymentFrequency;
  const amountCents =
    freq === "annual" ? (newPlan.annualPriceCents ?? 0) : (newPlan.monthlyPriceCents ?? 0);

  const oldPlan = await MembershipPlan.findOne({ _id: membership.planId, tenantId });
  const isUpgrade = (newPlan.tierLevel ?? 1) >= (oldPlan?.tierLevel ?? 1);
  const txType = isUpgrade ? "upgrade" : "downgrade";

  membership.planId = newPlan._id;
  membership.planCode = newPlanCode;
  membership.paymentFrequency = freq;
  await membership.save();

  const ikey = idempotencyKey ?? `membership-upgrade-${membershipId}-${Date.now()}`;
  await MembershipTransaction.create({
    tenantId,
    fanProfileId: membership.fanProfileId,
    membershipId: membership._id,
    transactionType: txType,
    planCode: newPlanCode,
    amountCents,
    paymentMethod,
    paymentFrequency: freq,
    status: "completed",
    periodStart: new Date(),
    periodEnd: membership.renewalDate,
    idempotencyKey: ikey,
    note: `From ${oldCode} to ${newPlanCode}`,
  });

  await publishEvent({
    tenantId,
    eventName: "membership.upgraded",
    source: "membership_service",
    fanProfileId: membership.fanProfileId,
    idempotencyKey: `evt-${ikey}`,
    payload: {
      membershipId: membership._id.toString(),
      fromPlanCode: oldCode,
      toPlanCode: newPlanCode,
      paymentFrequency: freq,
      amountCents,
    },
  });

  return membership;
}

export async function cancelMembership({ tenantId, membershipId, idempotencyKey }) {
  const membership = await FanMembership.findOne({ _id: membershipId, tenantId });
  if (!membership) {
    const err = new Error("Membership not found");
    err.status = 404;
    err.code = "MEMBERSHIP_NOT_FOUND";
    throw err;
  }

  membership.status = "cancelled";
  membership.cancelledAt = new Date();
  await membership.save();

  const ikey = idempotencyKey ?? `membership-cancel-${membershipId}-${Date.now()}`;
  await MembershipTransaction.create({
    tenantId,
    fanProfileId: membership.fanProfileId,
    membershipId: membership._id,
    transactionType: "cancellation",
    planCode: membership.planCode,
    amountCents: 0,
    paymentFrequency: membership.paymentFrequency,
    status: "completed",
    periodStart: new Date(),
    periodEnd: membership.renewalDate,
    idempotencyKey: ikey,
  });

  await publishEvent({
    tenantId,
    eventName: "membership.cancelled",
    source: "membership_service",
    fanProfileId: membership.fanProfileId,
    idempotencyKey: `evt-${ikey}`,
    payload: {
      membershipId: membership._id.toString(),
      planCode: membership.planCode,
    },
  });

  return membership;
}

export async function getMembershipStatus(tenantId, fanProfileId) {
  const membership = await FanMembership.findOne({ tenantId, fanProfileId, status: "active" })
    .populate("planId", "name planCode tierLevel priorityBase monthlyPriceCents annualPriceCents seatType sectorCode benefits");

  const score = await FanScore.findOne({ tenantId, fanProfileId });

  return {
    membership: membership ?? null,
    score: score
      ? {
          totalScore: score.totalScore,
          tier: score.tier,
          lastCalculatedAt: score.lastCalculatedAt,
        }
      : null,
  };
}

export async function listMemberships(tenantId, { status, planCode, search, limit = 50, offset = 0 } = {}) {
  const filter = { tenantId };
  if (status) filter.status = status;
  if (planCode) filter.planCode = planCode;

  // Search by fan name or email via a subquery on FanProfile
  if (search) {
    const regex = new RegExp(search, "i");
    const profiles = await FanProfile.find({
      tenantId,
      $or: [{ fullName: regex }, { email: regex }],
    }).select("_id");
    filter.fanProfileId = { $in: profiles.map((p) => p._id) };
  }

  const [data, total] = await Promise.all([
    FanMembership.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("fanProfileId", "fullName email memberId")
      .populate("planId", "name planCode tierLevel"),
    FanMembership.countDocuments(filter),
  ]);

  // Attach FanScore for each membership
  const fanProfileIds = data.map((m) => m.fanProfileId?._id ?? m.fanProfileId);
  const scores = await FanScore.find({ tenantId, fanProfileId: { $in: fanProfileIds } })
    .select("fanProfileId totalScore tier");
  const scoreByProfile = Object.fromEntries(
    scores.map((s) => [s.fanProfileId.toString(), s]),
  );

  const enriched = data.map((m) => {
    const obj = m.toJSON();
    const profileId = (m.fanProfileId?._id ?? m.fanProfileId)?.toString();
    obj.score = scoreByProfile[profileId] ?? null;
    return obj;
  });

  return { data: enriched, total, limit, offset };
}

export async function getMembershipById(tenantId, membershipId) {
  const m = await FanMembership.findOne({ _id: membershipId, tenantId })
    .populate("fanProfileId", "fullName email memberId")
    .populate("planId", "name planCode tierLevel priorityBase monthlyPriceCents annualPriceCents seatType sectorCode benefits");
  if (!m) {
    const err = new Error("Membership not found");
    err.status = 404;
    err.code = "MEMBERSHIP_NOT_FOUND";
    throw err;
  }
  return m;
}
