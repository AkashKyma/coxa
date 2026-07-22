import { Entitlement } from "../models/Entitlement.js";
import { Ticket } from "../models/Ticket.js";
import { MatchEvent } from "../models/MatchEvent.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { publishEvent } from "./cdp/cdpEventService.js";

export async function createEntitlementFromTicket(ticket, event) {
  const entitlementCode = `ENT-${ticket.ticketNumber}`;
  const existing = await Entitlement.findOne({ tenantId: ticket.tenantId, ticketId: ticket._id });
  if (existing) return existing;

  return Entitlement.create({
    tenantId: ticket.tenantId,
    entitlementCode,
    matchEventId: event._id ?? event.id ?? ticket.matchEventId,
    fanProfileId: ticket.fanProfileId,
    ticketId: ticket._id,
    sourceType: "ticket_purchase",
    sectionCode: ticket.sectionCode,
    qrToken: ticket.qrToken,
    status: "active",
    validFrom: event.gatesOpenAt ?? event.startsAt,
    validUntil: event.endsAt ?? event.startsAt,
  });
}

export async function createEntitlementFromCheckIn({
  tenantId,
  matchEventId,
  fanProfileId,
  sectionCode,
  qrToken,
}) {
  const entitlementCode = `CHK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return Entitlement.create({
    tenantId,
    entitlementCode,
    matchEventId,
    fanProfileId,
    sourceType: "member_check_in",
    sectionCode,
    qrToken: qrToken ?? entitlementCode,
    status: "active",
  });
}

export async function validateEntitlement({
  tenantId,
  qrToken,
  gateId,
  deviceId,
  markUsed = false,
  matchEventId,
}) {
  const ticket = await Ticket.findOne({ tenantId, qrToken })
    .populate("matchEventId", "title startsAt endsAt gatesOpenAt status")
    .populate("fanProfileId", "fullName email fanId")
    .populate("ticketProductId", "name sectionCode productCode");

  let entitlement = await Entitlement.findOne({
    tenantId,
    qrToken,
    status: "active",
  }).populate("matchEventId", "title startsAt endsAt gatesOpenAt status");

  if (!entitlement && ticket) {
    entitlement = await Entitlement.findOne({ tenantId, ticketId: ticket._id, status: "active" })
      .populate("matchEventId", "title startsAt endsAt gatesOpenAt status");
  }

  if (!entitlement && !ticket) {
    return {
      allowed: false,
      reason: "NOT_FOUND",
      message: "No valid entitlement found",
    };
  }

  const event = entitlement?.matchEventId ?? ticket?.matchEventId;
  const eventId = event?.id ?? event?._id?.toString();

  if (matchEventId && eventId && eventId !== matchEventId.toString()) {
    return {
      allowed: false,
      reason: "WRONG_EVENT",
      message: "Ticket is not valid for this event",
      entitlement,
      ticket,
      event,
    };
  }

  const now = new Date();

  if (event?.status === "cancelled") {
    return { allowed: false, reason: "EVENT_CANCELLED", message: "Event cancelled", entitlement };
  }

  if (event?.gatesOpenAt && now < new Date(event.gatesOpenAt)) {
    return { allowed: false, reason: "GATES_NOT_OPEN", message: "Gates not yet open", entitlement };
  }

  if (ticket?.status === "used") {
    return {
      allowed: false,
      reason: "ALREADY_USED",
      message: "Ticket already used",
      entitlement,
      ticket,
      event,
      usedAt: ticket.usedAt,
    };
  }

  if (ticket?.status === "cancelled") {
    return {
      allowed: false,
      reason: "TICKET_CANCELLED",
      message: "Ticket cancelled",
      entitlement,
      ticket,
      event,
    };
  }

  if (ticket && ticket.status !== "issued" && !entitlement) {
    return {
      allowed: false,
      reason: "INVALID_STATUS",
      message: `Ticket status: ${ticket.status}`,
      ticket,
      event,
    };
  }

  if (markUsed) {
    entitlement.status = "used";
    entitlement.usedAt = now;
    entitlement.gateId = gateId;
    entitlement.deviceId = deviceId;
    await entitlement.save();

    if (ticket) {
      ticket.status = "used";
      ticket.usedAt = now;
      await ticket.save();
    }

    await AttendanceRecord.create({
      tenantId,
      matchEventId: entitlement.matchEventId,
      fanProfileId: entitlement.fanProfileId,
      ticketId: ticket?._id,
      entitlementId: entitlement._id,
      attendanceStatus: "present",
      entryMethod: "qr",
      gateId,
      recordedAt: now,
    });

    await publishEvent({
      tenantId,
      eventName: "ticket.used",
      source: "gate_access",
      fanProfileId: entitlement.fanProfileId,
      idempotencyKey: `ticket-used-${entitlement._id.toString()}-${now.toISOString().slice(0, 13)}`,
      payload: {
        entitlementId: entitlement.id,
        ticketId: ticket?.id,
        matchEventId: entitlement.matchEventId?.id ?? entitlement.matchEventId,
        gateId,
        entryMethod: "qr",
      },
    });
  }

  return {
    allowed: true,
    reason: "VALID",
    message: "Entry allowed",
    entitlement,
    ticket,
    event,
  };
}

export async function manualOverrideEntitlement({
  tenantId,
  qrToken,
  fanProfileId,
  matchEventId,
  gateId,
  reason,
  overrideBy,
}) {
  let entitlement;

  if (qrToken) {
    const result = await validateEntitlement({ tenantId, qrToken, gateId, markUsed: true });
    if (result.allowed) return result;
  }

  const event = await MatchEvent.findOne({ _id: matchEventId, tenantId });
  if (!event) {
    const err = new Error("Event not found");
    err.status = 404;
    err.code = "EVENT_NOT_FOUND";
    throw err;
  }

  entitlement = await Entitlement.create({
    tenantId,
    entitlementCode: `OVR-${Date.now()}`,
    matchEventId: event._id,
    fanProfileId,
    sourceType: "manual",
    status: "used",
    usedAt: new Date(),
    gateId,
    overrideReason: reason,
    overrideBy,
    qrToken: qrToken ?? `override-${Date.now()}`,
  });

  await AttendanceRecord.create({
    tenantId,
    matchEventId: event._id,
    fanProfileId,
    entitlementId: entitlement._id,
    attendanceStatus: "present",
    entryMethod: "manual_override",
    gateId,
    note: reason,
  });

  return {
    allowed: true,
    reason: "OVERRIDE",
    message: "Manual override approved",
    entitlement,
    event,
  };
}

export async function recordNoShows(tenantId, matchEventId) {
  const event = await MatchEvent.findOne({ _id: matchEventId, tenantId });
  if (!event) {
    const err = new Error("Event not found");
    err.status = 404;
    err.code = "EVENT_NOT_FOUND";
    throw err;
  }

  const unusedTickets = await Ticket.find({
    tenantId,
    matchEventId,
    status: "issued",
    fanProfileId: { $exists: true, $ne: null },
  });

  const records = [];
  for (const ticket of unusedTickets) {
    const existing = await AttendanceRecord.findOne({
      tenantId,
      matchEventId,
      fanProfileId: ticket.fanProfileId,
      ticketId: ticket._id,
    });
    if (existing) continue;

    const record = await AttendanceRecord.create({
      tenantId,
      matchEventId,
      fanProfileId: ticket.fanProfileId,
      ticketId: ticket._id,
      attendanceStatus: "no_show",
      recordedAt: new Date(),
      note: "Auto no-show after event",
    });
    records.push(record);

    await publishEvent({
      tenantId,
      eventName: "no_show.recorded",
      source: "ticketing_service",
      fanProfileId: ticket.fanProfileId,
      idempotencyKey: `no-show-${ticket._id.toString()}`,
      payload: {
        ticketId: ticket.id,
        matchEventId: event.id,
        eventTitle: event.title,
      },
    });
  }

  if (event.status !== "completed") {
    event.status = "completed";
    await event.save();
  }

  return { count: records.length, records };
}
