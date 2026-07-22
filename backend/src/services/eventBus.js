import { CdpEvent } from "../models/CdpEvent.js";
import { findFanProfile } from "./fanProfileService.js";
import { processEventSideEffects } from "./eventProcessors.js";

const ALLOWED_EVENT_NAMES = new Set([
  "sale.completed",
  "sale.returned",
  "stock.transferred",
  "fan.registered",
  "fan.updated",
  "loyalty.points.earned",
  "loyalty.points.redeemed",
  "loyalty.points.reversed",
  "loyalty.points.adjusted",
  "loyalty.reward.redeemed",
  "segment.evaluated",
  "campaign.message.sent",
  "event.created",
  "ticket.reserved",
  "ticket.purchased",
  "member.checked_in",
  "ticket.used",
  "no_show.recorded",
  "membership.created",
  "membership.renewed",
  "membership.upgraded",
  "membership.cancelled",
  "referral.confirmed",
  "campaign.participated",
  "wastage.recorded",
]);

export async function ingestEvent({
  tenantId,
  eventName,
  source,
  fanProfileId,
  fanId,
  fanEmail,
  idempotencyKey,
  eventTimestamp,
  payload = {},
  payloadVersion = 1,
}) {
  if (!eventName || !source || !idempotencyKey) {
    const err = new Error("eventName, source and idempotencyKey are required");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!ALLOWED_EVENT_NAMES.has(eventName)) {
    const err = new Error(`Unknown event name: ${eventName}`);
    err.status = 400;
    err.code = "INVALID_EVENT_NAME";
    throw err;
  }

  const existing = await CdpEvent.findOne({ tenantId, idempotencyKey });
  if (existing) {
    return { event: existing, duplicate: true };
  }

  let resolvedFanId = fanProfileId;
  if (!resolvedFanId && (fanId || fanEmail)) {
    const profile = await findFanProfile(tenantId, { fanId, email: fanEmail });
    resolvedFanId = profile?._id;
  }

  const event = await CdpEvent.create({
    tenantId,
    eventName,
    source,
    fanProfileId: resolvedFanId,
    idempotencyKey,
    eventTimestamp: eventTimestamp ? new Date(eventTimestamp) : new Date(),
    payload,
    payloadVersion,
    status: "accepted",
  });

  try {
    await processEventSideEffects(event);
    event.processedAt = new Date();
    await event.save();
  } catch (procErr) {
    event.status = "dlq";
    event.rejectionReason = procErr.message;
    await event.save();
    throw procErr;
  }

  return { event, duplicate: false };
}

export async function publishDomainEvent(params) {
  return ingestEvent(params);
}

export async function listEvents(tenantId, { eventName, fanProfileId, status, limit = 100 } = {}) {
  const filter = { tenantId };
  if (eventName) filter.eventName = eventName;
  if (fanProfileId) filter.fanProfileId = fanProfileId;
  if (status) filter.status = status;

  const events = await CdpEvent.find(filter)
    .sort({ eventTimestamp: -1 })
    .limit(Math.min(limit, 500))
    .populate("fanProfileId", "fanId fullName email");

  return events;
}

export async function replayDlqEvent(tenantId, eventId) {
  const event = await CdpEvent.findOne({ _id: eventId, tenantId, status: "dlq" });
  if (!event) {
    const err = new Error("DLQ event not found");
    err.status = 404;
    err.code = "EVENT_NOT_FOUND";
    throw err;
  }

  event.status = "accepted";
  event.rejectionReason = undefined;
  await processEventSideEffects(event);
  event.processedAt = new Date();
  await event.save();
  return event;
}
