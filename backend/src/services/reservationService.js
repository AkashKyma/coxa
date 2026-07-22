import { TicketReservation } from "../models/TicketReservation.js";
import { TicketProduct } from "../models/TicketProduct.js";
import {
  getMatchEvent,
  getTicketProduct,
  assertProductAvailability,
} from "./ticketingCatalogService.js";
import { findFanProfile } from "./fanProfileService.js";
import { publishEvent } from "./cdp/cdpEventService.js";

const RESERVATION_TTL_MS = 15 * 60 * 1000;

async function expireStaleReservations(tenantId, matchEventId) {
  const now = new Date();
  const stale = await TicketReservation.find({
    tenantId,
    matchEventId,
    status: "active",
    expiresAt: { $lte: now },
  });

  for (const reservation of stale) {
    for (const line of reservation.lines) {
      await TicketProduct.updateOne(
        { _id: line.ticketProductId },
        { $inc: { reservedCount: -line.qty } },
      );
    }
    reservation.status = "expired";
    await reservation.save();
  }
}

export async function createReservation({
  tenantId,
  matchEventId,
  lines,
  fanProfileId,
  fanEmail,
  channel = "fan_app",
  idempotencyKey,
}) {
  const existing = await TicketReservation.findOne({ tenantId, idempotencyKey });
  if (existing) return { reservation: existing, duplicate: true };

  await expireStaleReservations(tenantId, matchEventId);
  const event = await getMatchEvent(tenantId, matchEventId);

  if (!["published", "on_sale"].includes(event.status)) {
    const err = new Error("Event is not available for reservation");
    err.status = 400;
    err.code = "EVENT_NOT_ON_SALE";
    throw err;
  }

  let resolvedFanId = fanProfileId;
  if (!resolvedFanId && fanEmail) {
    const profile = await findFanProfile(tenantId, { email: fanEmail });
    resolvedFanId = profile?._id;
  }

  const resolvedLines = [];
  let totalCents = 0;

  for (const line of lines) {
    const qty = Number(line.qty);
    if (!line.ticketProductId || !Number.isFinite(qty) || qty < 1) {
      const err = new Error("Each line needs ticketProductId and qty >= 1");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const product = await getTicketProduct(tenantId, line.ticketProductId);
    if (product.matchEventId.toString() !== matchEventId.toString()) {
      const err = new Error("Product does not belong to this event");
      err.status = 400;
      err.code = "PRODUCT_EVENT_MISMATCH";
      throw err;
    }

    await assertProductAvailability(product, qty);
    resolvedLines.push({
      ticketProductId: product._id,
      qty,
      unitPriceCents: product.priceCents,
    });
    totalCents += product.priceCents * qty;
  }

  for (const line of resolvedLines) {
    const updated = await TicketProduct.findOneAndUpdate(
      {
        _id: line.ticketProductId,
        $expr: {
          $gte: [
            { $subtract: ["$capacity", { $add: ["$soldCount", "$reservedCount"] }] },
            line.qty,
          ],
        },
      },
      { $inc: { reservedCount: line.qty } },
      { new: true },
    );
    if (!updated) {
      const err = new Error("Inventory changed during reservation");
      err.status = 409;
      err.code = "INVENTORY_CONFLICT";
      throw err;
    }
  }

  const reservationNumber = `RSV-${Date.now()}`;
  const reservation = await TicketReservation.create({
    tenantId,
    reservationNumber,
    matchEventId: event._id,
    fanProfileId: resolvedFanId,
    lines: resolvedLines,
    totalCents,
    status: "active",
    expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
    idempotencyKey,
    channel,
  });

  await publishEvent({
    tenantId,
    eventName: "ticket.reserved",
    source: channel === "box_office" ? "box_office" : "fan_app",
    fanProfileId: resolvedFanId,
    idempotencyKey: `ticket-reserved-${idempotencyKey}`,
    payload: {
      reservationId: reservation.id,
      reservationNumber,
      matchEventId: event.id,
      totalCents,
      lineCount: resolvedLines.reduce((s, l) => s + l.qty, 0),
    },
  });

  return { reservation, duplicate: false };
}

export async function cancelReservation(tenantId, reservationId) {
  const reservation = await TicketReservation.findOne({
    _id: reservationId,
    tenantId,
    status: "active",
  });
  if (!reservation) {
    const err = new Error("Active reservation not found");
    err.status = 404;
    err.code = "RESERVATION_NOT_FOUND";
    throw err;
  }

  for (const line of reservation.lines) {
    await TicketProduct.updateOne(
      { _id: line.ticketProductId },
      { $inc: { reservedCount: -line.qty } },
    );
  }
  reservation.status = "cancelled";
  await reservation.save();
  return reservation;
}

export async function getReservation(tenantId, reservationId) {
  const reservation = await TicketReservation.findOne({ _id: reservationId, tenantId });
  if (!reservation) {
    const err = new Error("Reservation not found");
    err.status = 404;
    err.code = "RESERVATION_NOT_FOUND";
    throw err;
  }
  if (reservation.status === "active" && reservation.expiresAt <= new Date()) {
    await cancelReservation(tenantId, reservationId);
    reservation.status = "expired";
  }
  return reservation;
}

export async function convertReservationInventory(reservation) {
  for (const line of reservation.lines) {
    await TicketProduct.updateOne(
      { _id: line.ticketProductId },
      { $inc: { reservedCount: -line.qty, soldCount: line.qty } },
    );
  }
  reservation.status = "converted";
  await reservation.save();
}
