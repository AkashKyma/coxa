import { Referral, generateReferralCode } from "../models/Referral.js";
import { FanProfile } from "../models/FanProfile.js";
import { FanMembership } from "../models/FanMembership.js";
import { earnPoints } from "./loyaltyService.js";
import { publishEvent } from "./cdp/cdpEventService.js";

const REFERRAL_POINTS = 1_000;

/**
 * Returns an existing referral code for the fan, or creates one.
 * Idempotent — calling multiple times returns the same code.
 */
export async function getOrCreateReferralCode(tenantId, fanProfileId) {
  const existing = await Referral.findOne({
    tenantId,
    referrerFanProfileId: fanProfileId,
    // A fan's "personal code" is stored on a self-referential doc with no referee
    refereeFanProfileId: { $exists: false },
    status: { $in: ["pending", "rewarded"] },
  });

  if (existing) return existing.referralCode;

  // Generate a unique code, retry on collision (unlikely but safe)
  let code;
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateReferralCode();
    const clash = await Referral.findOne({ tenantId, referralCode: candidate });
    if (!clash) { code = candidate; break; }
    attempts++;
  }

  if (!code) {
    const err = new Error("Could not generate a unique referral code");
    err.status = 500;
    err.code = "REFERRAL_CODE_COLLISION";
    throw err;
  }

  // Seed doc represents "this fan's shareable code" — no referee yet
  await Referral.create({
    tenantId,
    referrerFanProfileId: fanProfileId,
    referralCode: code,
    status: "pending",
  });

  return code;
}

/**
 * A new fan redeems a referral code during / after registration.
 * Creates a linked Referral record. Reward fires on membership confirmation.
 */
export async function redeemReferralCode(tenantId, refereeFanProfileId, code) {
  const referee = await FanProfile.findOne({ _id: refereeFanProfileId, tenantId, status: "active" });
  if (!referee) {
    const err = new Error("Fan profile not found");
    err.status = 404;
    err.code = "FAN_NOT_FOUND";
    throw err;
  }

  const codeDoc = await Referral.findOne({ tenantId, referralCode: code.toUpperCase() });
  if (!codeDoc) {
    const err = new Error("Referral code not found");
    err.status = 404;
    err.code = "REFERRAL_CODE_NOT_FOUND";
    throw err;
  }

  if (codeDoc.referrerFanProfileId.toString() === refereeFanProfileId.toString()) {
    const err = new Error("Cannot use your own referral code");
    err.status = 400;
    err.code = "SELF_REFERRAL";
    throw err;
  }

  // Prevent double-use by same referee
  const alreadyUsed = await Referral.findOne({
    tenantId,
    refereeFanProfileId,
    status: { $in: ["confirmed", "rewarded"] },
  });
  if (alreadyUsed) {
    const err = new Error("You have already used a referral code");
    err.status = 409;
    err.code = "REFERRAL_ALREADY_USED";
    throw err;
  }

  const referral = await Referral.create({
    tenantId,
    referrerFanProfileId: codeDoc.referrerFanProfileId,
    refereeFanProfileId,
    referralCode: code.toUpperCase(),
    status: "pending",
  });

  return referral;
}

/**
 * Confirms a referral once the referee has an active membership.
 * Called automatically on membership.created event.
 */
export async function confirmReferralForFan(tenantId, refereeFanProfileId) {
  const referral = await Referral.findOne({
    tenantId,
    refereeFanProfileId,
    status: "pending",
    referrerFanProfileId: { $exists: true },
    // Exclude the "personal code" seed doc (no referee)
  }).where("referrerFanProfileId").exists(true);

  if (!referral || !referral.refereeFanProfileId) return null;

  referral.status = "confirmed";
  referral.confirmedAt = new Date();
  await referral.save();

  await publishEvent({
    tenantId,
    eventName: "referral.confirmed",
    source: "referral_service",
    fanProfileId: referral.referrerFanProfileId,
    idempotencyKey: `referral-confirmed-${referral._id}`,
    payload: {
      referralId: referral._id.toString(),
      referrerFanProfileId: referral.referrerFanProfileId.toString(),
      refereeFanProfileId: referral.refereeFanProfileId.toString(),
      referralCode: referral.referralCode,
    },
  });

  return referral;
}

/**
 * Awards 1,000 points to the referrer and marks the referral rewarded.
 * Triggered by the referral.confirmed event in loyaltyService.
 */
export async function processReferralReward(tenantId, referralId) {
  const referral = await Referral.findOne({ _id: referralId, tenantId, status: "confirmed" });
  if (!referral) return null;

  await earnPoints({
    tenantId,
    fanProfileId: referral.referrerFanProfileId,
    points: REFERRAL_POINTS,
    referenceType: "referral",
    referenceId: referral._id.toString(),
    idempotencyKey: `earn-referral-${referral._id}`,
    note: `Referral bonus — code ${referral.referralCode}`,
    createdBy: "system",
  });

  referral.status = "rewarded";
  referral.rewardedAt = new Date();
  await referral.save();

  return referral;
}

export async function listReferrals(tenantId, fanProfileId) {
  return Referral.find({
    tenantId,
    referrerFanProfileId: fanProfileId,
    refereeFanProfileId: { $exists: true },
  })
    .sort({ createdAt: -1 })
    .populate("refereeFanProfileId", "fullName email");
}
