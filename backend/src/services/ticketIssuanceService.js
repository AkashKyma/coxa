import { Ticket, generateQrToken } from "../models/Ticket.js";
import { TicketProduct } from "../models/TicketProduct.js";
import { MatchEvent } from "../models/MatchEvent.js";
import { FanProfile } from "../models/FanProfile.js";
import {
  getMatchEvent,
  getTicketProduct,
  assertProductAvailability,
} from "./ticketingCatalogService.js";
import {
  getReservation,
  convertReservationInventory,
  createReservation,
} from "./reservationService.js";
import { createEntitlementFromTicket } from "./entitlementService.js";
import { findFanProfile } from "./fanProfileService.js";
import { publishEvent } from "./cdp/cdpEventService.js";

export async function listTickets(tenantId, { fanProfileId, fanEmail, matchEventId, status } = {}) {
  const filter = { tenantId };
  if (matchEventId) filter.matchEventId = matchEventId;
  if (status) filter.status = status;

  if (fanProfileId) {
    filter.fanProfileId = fanProfileId;
  } else if (fanEmail) {
    const profile = await findFanProfile(tenantId, { email: fanEmail });
    if (!profile) return [];
    filter.fanProfileId = profile._id;
  }

  return Ticket.find(filter)
    .sort({ issuedAt: -1 })
    .populate("matchEventId", "title eventCode startsAt homeTeam awayTeam status")
    .populate("ticketProductId", "name productCode sectionCode audienceType");
}

export async function issueTicketsFromReservation({
  tenantId,
  reservationId,
  paymentMethod = "stub",
  idempotencyKey,
  channel,
}) {
  const existingTicket = await Ticket.findOne({ tenantId, idempotencyKey });
  if (existingTicket) {
    const tickets = await Ticket.find({ tenantId, reservationId });
    return { tickets, duplicate: true };
  }

  const reservation = await getReservation(tenantId, reservationId);
  if (reservation.status !== "active") {
    const err = new Error("Reservation is not active");
    err.status = 400;
    err.code = "RESERVATION_NOT_ACTIVE";
    throw err;
  }

  const event = await getMatchEvent(tenantId, reservation.matchEventId);
  const tickets = [];

  for (const line of reservation.lines) {
    const product = await getTicketProduct(tenantId, line.ticketProductId);
    for (let i = 0; i < line.qty; i += 1) {
      const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const qrToken = generateQrToken();
      const ticket = await Ticket.create({
        tenantId,
        ticketNumber,
        matchEventId: event._id,
        ticketProductId: product._id,
        fanProfileId: reservation.fanProfileId,
        reservationId: reservation._id,
        sectionCode: product.sectionCode,
        priceCents: product.priceCents,
        qrToken,
        status: "issued",
        paymentStatus: "paid",
        paymentMethod,
        channel: channel ?? reservation.channel,
        idempotencyKey: `${idempotencyKey}-${product._id}-${i}`,
      });
      await createEntitlementFromTicket(ticket, event);
      tickets.push(ticket);
    }
  }

  await convertReservationInventory(reservation);

  const soldTotal = tickets.reduce((s, t) => s + t.priceCents, 0);
  await publishEvent({
    tenantId,
    eventName: "ticket.purchased",
    source: channel ?? reservation.channel ?? "ticketing_service",
    fanProfileId: reservation.fanProfileId,
    idempotencyKey: `ticket-purchased-${idempotencyKey}`,
    payload: {
      matchEventId: event.id,
      eventTitle: event.title,
      reservationId: reservation.id,
      ticketCount: tickets.length,
      totalCents: soldTotal,
      ticketIds: tickets.map((t) => t.id),
    },
  });

  await syncEventSoldOutStatus(tenantId, event._id);

  return { tickets, duplicate: false };
}

export async function purchaseTicketsDirect({
  tenantId,
  matchEventId,
  lines,
  fanProfileId,
  fanEmail,
  paymentMethod = "stub",
  channel = "fan_app",
  idempotencyKey,
}) {
  const { reservation } = await createReservation({
    tenantId,
    matchEventId,
    lines,
    fanProfileId,
    fanEmail,
    channel,
    idempotencyKey: `reserve-${idempotencyKey}`,
  });

  return issueTicketsFromReservation({
    tenantId,
    reservationId: reservation._id,
    paymentMethod,
    idempotencyKey,
    channel,
  });
}

export async function issueTicketsDirect({
  tenantId,
  matchEventId,
  ticketProductId,
  qty,
  fanProfileId,
  fanEmail,
  paymentMethod = "cash",
  channel = "box_office",
  idempotencyKey,
  skipReservation = false,
}) {
  if (!skipReservation) {
    return purchaseTicketsDirect({
      tenantId,
      matchEventId,
      lines: [{ ticketProductId, qty }],
      fanProfileId,
      fanEmail,
      paymentMethod,
      channel,
      idempotencyKey,
    });
  }

  const existing = await Ticket.findOne({ tenantId, idempotencyKey });
  if (existing) {
    return { tickets: await Ticket.find({ tenantId, idempotencyKey: new RegExp(`^${idempotencyKey}`) }), duplicate: true };
  }

  const event = await getMatchEvent(tenantId, matchEventId);
  const product = await getTicketProduct(tenantId, ticketProductId);

  if (product.requiresMemberId && fanEmail) {
    const profile = await findFanProfile(tenantId, { fanProfileId, email: fanEmail });
    if (!profile?.memberId) {
      const err = new Error("Member ID required for this ticket product");
      err.status = 400;
      err.code = "MEMBER_REQUIRED";
      throw err;
    }
    fanProfileId = profile._id;
  }

  await assertProductAvailability(product, qty);

  const tickets = [];
  for (let i = 0; i < qty; i += 1) {
    const updated = await TicketProduct.findOneAndUpdate(
      {
        _id: product._id,
        $expr: {
          $gte: [
            { $subtract: ["$capacity", { $add: ["$soldCount", "$reservedCount"] }] },
            1,
          ],
        },
      },
      { $inc: { soldCount: 1 } },
      { new: true },
    );
    if (!updated) {
      const err = new Error("Insufficient inventory");
      err.status = 409;
      err.code = "INSUFFICIENT_INVENTORY";
      throw err;
    }

    let resolvedFanId = fanProfileId;
    if (!resolvedFanId && fanEmail) {
      const profile = await findFanProfile(tenantId, { email: fanEmail });
      resolvedFanId = profile?._id;
    }

    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const ticket = await Ticket.create({
      tenantId,
      ticketNumber,
      matchEventId: event._id,
      ticketProductId: product._id,
      fanProfileId: resolvedFanId,
      sectionCode: product.sectionCode,
      priceCents: product.priceCents,
      qrToken: generateQrToken(),
      status: "issued",
      paymentStatus: "paid",
      paymentMethod,
      channel,
      idempotencyKey: `${idempotencyKey}-${i}`,
    });
    await createEntitlementFromTicket(ticket, event);
    tickets.push(ticket);
  }

  await publishEvent({
    tenantId,
    eventName: "ticket.purchased",
    source: channel,
    fanProfileId: tickets[0]?.fanProfileId,
    idempotencyKey: `ticket-purchased-${idempotencyKey}`,
    payload: {
      matchEventId: event.id,
      eventTitle: event.title,
      ticketCount: tickets.length,
      totalCents: tickets.reduce((s, t) => s + t.priceCents, 0),
      ticketIds: tickets.map((t) => t.id),
    },
  });

  await syncEventSoldOutStatus(tenantId, event._id);
  return { tickets, duplicate: false };
}

async function syncEventSoldOutStatus(tenantId, matchEventId) {
  const products = await TicketProduct.find({ tenantId, matchEventId, status: "active" });
  const allSoldOut = products.length > 0 && products.every((p) => p.capacity <= p.soldCount + p.reservedCount);
  if (allSoldOut) {
    await MatchEvent.updateOne({ _id: matchEventId, tenantId }, { status: "sold_out" });
    for (const p of products) {
      if (p.capacity <= p.soldCount + p.reservedCount) {
        p.status = "sold_out";
        await p.save();
      }
    }
  }
}

export async function cancelTicket(tenantId, ticketId, reason) {
  const ticket = await Ticket.findOne({ _id: ticketId, tenantId, status: "issued" });
  if (!ticket) {
    const err = new Error("Issued ticket not found");
    err.status = 404;
    err.code = "TICKET_NOT_FOUND";
    throw err;
  }

  ticket.status = "cancelled";
  ticket.cancelledAt = new Date();
  await ticket.save();

  await TicketProduct.updateOne({ _id: ticket.ticketProductId }, { $inc: { soldCount: -1 } });

  return ticket;
}
