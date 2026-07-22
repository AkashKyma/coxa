import { Venue } from "../models/Venue.js";
import { MatchEvent } from "../models/MatchEvent.js";
import { TicketProduct } from "../models/TicketProduct.js";
import { publishEvent } from "./cdp/cdpEventService.js";

export async function listVenues(tenantId, { includeInactive = false } = {}) {
  const filter = { tenantId };
  if (!includeInactive) filter.status = "active";
  return Venue.find(filter).sort({ name: 1 });
}

export async function getVenue(tenantId, venueId) {
  const venue = await Venue.findOne({ _id: venueId, tenantId });
  if (!venue) {
    const err = new Error("Venue not found");
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  return venue;
}

export async function createVenue(tenantId, data) {
  const totalCapacity =
    data.totalCapacity ??
    (data.sections?.reduce((sum, s) => sum + Number(s.capacity ?? 0), 0) || 0);

  return Venue.create({
    tenantId,
    code: data.code,
    name: data.name,
    address: data.address,
    city: data.city,
    totalCapacity,
    sections: data.sections ?? [],
    status: data.status ?? "active",
  });
}

export async function updateVenue(tenantId, venueId, data) {
  const venue = await getVenue(tenantId, venueId);

  if (data.code !== undefined) venue.code = data.code;
  if (data.name !== undefined) venue.name = data.name;
  if (data.address !== undefined) venue.address = data.address;
  if (data.city !== undefined) venue.city = data.city;
  if (data.status !== undefined) venue.status = data.status;

  if (data.sections !== undefined) {
    venue.sections = data.sections.map((s) => ({
      ...(s.id ? { _id: s.id } : {}),
      code: s.code,
      name: s.name,
      capacity: Number(s.capacity),
      sectionType: s.sectionType ?? "general",
      status: s.status ?? "active",
    }));
    venue.totalCapacity = venue.sections.reduce((sum, s) => sum + (s.capacity ?? 0), 0);
  } else if (data.totalCapacity !== undefined) {
    venue.totalCapacity = data.totalCapacity;
  }

  await venue.save();
  return venue;
}

export async function deleteVenue(tenantId, venueId) {
  const venue = await getVenue(tenantId, venueId);
  const inUse = await MatchEvent.exists({ tenantId, venueId: venue._id });
  if (inUse) {
    venue.status = "inactive";
    await venue.save();
    return { venue, softDeleted: true };
  }
  await venue.deleteOne();
  return { venue, softDeleted: false };
}

export async function listMatchEvents(tenantId, { status, upcoming } = {}) {
  const filter = { tenantId };
  if (status) filter.status = status;
  if (upcoming) {
    filter.startsAt = { $gte: new Date() };
    filter.status = { $in: ["published", "on_sale", "sold_out"] };
  }
  return MatchEvent.find(filter).sort({ startsAt: 1 }).populate("venueId", "name code city");
}

export async function getMatchEvent(tenantId, eventId) {
  const event = await MatchEvent.findOne({ _id: eventId, tenantId }).populate(
    "venueId",
    "name code city sections totalCapacity",
  );
  if (!event) {
    const err = new Error("Event not found");
    err.status = 404;
    err.code = "EVENT_NOT_FOUND";
    throw err;
  }
  return event;
}

export async function createMatchEvent(tenantId, data, createdBy) {
  const venue = await Venue.findOne({ _id: data.venueId, tenantId });
  if (!venue) {
    const err = new Error("Venue not found");
    err.status = 404;
    err.code = "VENUE_NOT_FOUND";
    throw err;
  }

  const event = await MatchEvent.create({
    tenantId,
    eventCode: data.eventCode,
    title: data.title,
    description: data.description,
    eventType: data.eventType ?? "match",
    venueId: venue._id,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    startsAt: new Date(data.startsAt),
    endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
    gatesOpenAt: data.gatesOpenAt ? new Date(data.gatesOpenAt) : undefined,
    saleStartsAt: data.saleStartsAt ? new Date(data.saleStartsAt) : undefined,
    saleEndsAt: data.saleEndsAt ? new Date(data.saleEndsAt) : undefined,
    capacity: data.capacity ?? venue.totalCapacity,
    status: data.status ?? "draft",
    createdBy,
  });

  await publishEvent({
    tenantId,
    eventName: "event.created",
    source: "ticketing_service",
    idempotencyKey: `event-created-${event._id.toString()}`,
    payload: {
      eventId: event.id,
      eventCode: event.eventCode,
      title: event.title,
      startsAt: event.startsAt,
    },
  });

  return event;
}

export async function updateMatchEventStatus(tenantId, eventId, status, updatedBy) {
  const event = await getMatchEvent(tenantId, eventId);
  event.status = status;
  event.updatedBy = updatedBy;
  await event.save();
  return event;
}

export async function listTicketProducts(tenantId, matchEventId) {
  return TicketProduct.find({ tenantId, matchEventId }).sort({ priceCents: 1 });
}

export async function createTicketProduct(tenantId, data) {
  const event = await getMatchEvent(tenantId, data.matchEventId);

  let sectionCode = data.sectionCode;
  if (data.sectionId && event.venueId?.sections) {
    const section = event.venueId.sections.find(
      (s) => s._id?.toString() === data.sectionId.toString(),
    );
    sectionCode = section?.code ?? sectionCode;
  }

  return TicketProduct.create({
    tenantId,
    matchEventId: event._id,
    productCode: data.productCode,
    name: data.name,
    description: data.description,
    sectionId: data.sectionId,
    sectionCode,
    audienceType: data.audienceType ?? "public",
    priceCents: data.priceCents,
    capacity: data.capacity,
    maxPerOrder: data.maxPerOrder ?? 6,
    requiresMemberId: data.requiresMemberId ?? false,
    status: "active",
  });
}

export async function getTicketProduct(tenantId, productId) {
  const product = await TicketProduct.findOne({ _id: productId, tenantId });
  if (!product) {
    const err = new Error("Ticket product not found");
    err.status = 404;
    err.code = "PRODUCT_NOT_FOUND";
    throw err;
  }
  return product;
}

export function getAvailableCount(product) {
  return Math.max(0, product.capacity - product.soldCount - product.reservedCount);
}

export async function assertProductAvailability(product, qty) {
  const available = getAvailableCount(product);
  if (qty > available) {
    const err = new Error(`Insufficient inventory: ${available} available`);
    err.status = 409;
    err.code = "INSUFFICIENT_INVENTORY";
    throw err;
  }
  if (qty > product.maxPerOrder) {
    const err = new Error(`Max ${product.maxPerOrder} tickets per order`);
    err.status = 400;
    err.code = "MAX_PER_ORDER_EXCEEDED";
    throw err;
  }
}
