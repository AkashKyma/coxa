import { MembershipPlan } from "../models/MembershipPlan.js";
import { CheckInWindow } from "../models/CheckInWindow.js";
import { FanProfile } from "../models/FanProfile.js";
import { getMatchEvent } from "./ticketingCatalogService.js";
import { createEntitlementFromCheckIn } from "./entitlementService.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { publishEvent } from "./cdp/cdpEventService.js";
import { generateQrToken } from "../models/Ticket.js";

export async function listMembershipPlans(tenantId) {
  return MembershipPlan.find({ tenantId, status: "active" }).sort({ tierLevel: 1 });
}

export async function createMembershipPlan(tenantId, data) {
  const filter = { tenantId, planCode: data.planCode };
  const update = {
    $set: {
      name: data.name,
      tierLevel: data.tierLevel ?? 1,
      description: data.description,
      benefits: data.benefits ?? [],
      priorityOrder: data.priorityOrder ?? 100,
      monthlyPriceCents: data.monthlyPriceCents ?? 0,
      annualPriceCents: data.annualPriceCents ?? 0,
      seatType: data.seatType ?? "general",
      sectorCode: data.sectorCode,
      priorityBase: data.priorityBase ?? 100,
      status: "active",
    },
  };
  return MembershipPlan.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  });
}

export async function listCheckInWindows(tenantId, matchEventId) {
  return CheckInWindow.find({ tenantId, matchEventId })
    .sort({ opensAt: 1 })
    .populate("membershipPlanId", "name planCode tierLevel");
}

export async function createCheckInWindow(tenantId, data) {
  await getMatchEvent(tenantId, data.matchEventId);
  const plan = await MembershipPlan.findOne({ _id: data.membershipPlanId, tenantId });
  if (!plan) {
    const err = new Error("Membership plan not found");
    err.status = 404;
    err.code = "PLAN_NOT_FOUND";
    throw err;
  }

  return CheckInWindow.create({
    tenantId,
    matchEventId: data.matchEventId,
    membershipPlanId: plan._id,
    name: data.name ?? `${plan.name} check-in`,
    opensAt: new Date(data.opensAt),
    closesAt: new Date(data.closesAt),
    capacity: data.capacity,
    fanScoreMin: data.fanScoreMin ?? 0,
    status: "scheduled",
  });
}

function resolveWindowStatus(window, now = new Date()) {
  if (now < window.opensAt) return "scheduled";
  if (now > window.closesAt) return "closed";
  return "open";
}

export async function syncCheckInWindowStatuses(tenantId, matchEventId) {
  const windows = await CheckInWindow.find({ tenantId, matchEventId });
  const now = new Date();
  for (const window of windows) {
    const next = resolveWindowStatus(window, now);
    if (window.status !== next) {
      window.status = next;
      await window.save();
    }
  }
}

export async function memberCheckIn({
  tenantId,
  matchEventId,
  fanEmail,
  fanProfileId,
  memberId,
  checkInWindowId,
  idempotencyKey,
}) {
  const existing = await AttendanceRecord.findOne({
    tenantId,
    idempotencyKey,
  });
  if (existing) {
    return { duplicate: true, record: existing };
  }

  await syncCheckInWindowStatuses(tenantId, matchEventId);

  let profile;
  if (fanProfileId) {
    profile = await FanProfile.findOne({ _id: fanProfileId, tenantId, status: "active" });
  } else if (fanEmail) {
    profile = await FanProfile.findOne({ tenantId, email: fanEmail.toLowerCase(), status: "active" });
  } else if (memberId) {
    profile = await FanProfile.findOne({ tenantId, memberId, status: "active" });
  }

  if (!profile) {
    const err = new Error("Fan profile not found");
    err.status = 404;
    err.code = "FAN_NOT_FOUND";
    throw err;
  }

  if (!profile.memberId) {
    const err = new Error("Fan is not a member");
    err.status = 400;
    err.code = "NOT_A_MEMBER";
    throw err;
  }

  const window = await CheckInWindow.findOne({ _id: checkInWindowId, tenantId, matchEventId });
  if (!window) {
    const err = new Error("Check-in window not found");
    err.status = 404;
    err.code = "CHECKIN_WINDOW_NOT_FOUND";
    throw err;
  }

  const now = new Date();
  const status = resolveWindowStatus(window, now);
  if (status !== "open") {
    const err = new Error(status === "closed" ? "Check-in window closed" : "Check-in window not open yet");
    err.status = 400;
    err.code = "CHECKIN_WINDOW_CLOSED";
    throw err;
  }

  if (window.checkedInCount >= window.capacity) {
    const err = new Error("Check-in capacity reached");
    err.status = 409;
    err.code = "CHECKIN_CAPACITY_FULL";
    throw err;
  }

  const prior = await AttendanceRecord.findOne({
    tenantId,
    matchEventId,
    fanProfileId: profile._id,
    attendanceStatus: { $in: ["checked_in_only", "present"] },
  });
  if (prior) {
    const err = new Error("Member already checked in for this event");
    err.status = 409;
    err.code = "ALREADY_CHECKED_IN";
    throw err;
  }

  const updated = await CheckInWindow.findOneAndUpdate(
    { _id: window._id, $expr: { $lt: ["$checkedInCount", "$capacity"] } },
    { $inc: { checkedInCount: 1 } },
    { new: true },
  );
  if (!updated) {
    const err = new Error("Check-in capacity reached");
    err.status = 409;
    err.code = "CHECKIN_CAPACITY_FULL";
    throw err;
  }

  const qrToken = generateQrToken();
  const entitlement = await createEntitlementFromCheckIn({
    tenantId,
    matchEventId,
    fanProfileId: profile._id,
    sectionCode: "MEMBER",
    qrToken,
  });

  const record = await AttendanceRecord.create({
    tenantId,
    matchEventId,
    fanProfileId: profile._id,
    entitlementId: entitlement._id,
    attendanceStatus: "checked_in_only",
    entryMethod: "check_in",
    idempotencyKey,
    recordedAt: now,
  });

  await publishEvent({
    tenantId,
    eventName: "member.checked_in",
    source: "ticketing_service",
    fanProfileId: profile._id,
    idempotencyKey: `member-checkin-${idempotencyKey}`,
    payload: {
      matchEventId,
      memberId: profile.memberId,
      checkInWindowId: window.id,
      entitlementId: entitlement.id,
    },
  });

  return { duplicate: false, record, entitlement, profile };
}
