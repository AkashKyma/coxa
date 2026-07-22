import { StockLot } from "../models/StockLot.js";
import { Sku } from "../models/Sku.js";
import { Product } from "../models/Product.js";
import { Location } from "../models/Location.js";
import { applyStockDelta } from "./stockService.js";
import { publishEvent } from "./cdp/cdpEventService.js";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function deriveSellByDate({ sellByDate, expirationDate, purchaseDate, sellByBufferDays = 1 }) {
  if (sellByDate) return startOfDay(sellByDate);
  if (expirationDate) {
    const exp = startOfDay(expirationDate);
    exp.setDate(exp.getDate() - sellByBufferDays);
    return exp;
  }
  const fallback = startOfDay(purchaseDate);
  fallback.setDate(fallback.getDate() + 7);
  return fallback;
}

export function lotAvailabilityStatus(lot, now = new Date()) {
  const today = startOfDay(now);
  if (lot.status !== "active" || lot.qtyOnHand <= 0) return lot.status;
  if (startOfDay(lot.expirationDate) < today) return "expired";
  if (startOfDay(lot.sellByDate) < today) return "past_sell_by";
  const warnDate = new Date(today);
  warnDate.setDate(warnDate.getDate() + 3);
  if (startOfDay(lot.sellByDate) <= warnDate) return "expiring_soon";
  return "ok";
}

export async function receiveStockLot({
  tenantId,
  locationId,
  skuId,
  qty,
  purchaseDate,
  expirationDate,
  sellByDate,
  lotNumber,
  supplierName,
  unitCostCents,
  note,
  createdBy,
}) {
  const amount = Number(qty);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("qty must be a positive number");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const [sku, location] = await Promise.all([
    Sku.findOne({ _id: skuId, tenantId, status: "active" }),
    Location.findOne({ _id: locationId, tenantId, status: "active" }),
  ]);
  if (!sku) {
    const err = new Error("SKU not found");
    err.status = 404;
    err.code = "SKU_NOT_FOUND";
    throw err;
  }
  if (!location) {
    const err = new Error("Location not found");
    err.status = 404;
    err.code = "LOCATION_NOT_FOUND";
    throw err;
  }

  const product = await Product.findById(sku.productId);
  if (!product?.trackLots) {
    const err = new Error("This product is not configured for lot tracking");
    err.status = 400;
    err.code = "LOT_TRACKING_DISABLED";
    throw err;
  }

  const purchased = startOfDay(purchaseDate ?? new Date());
  const expires = startOfDay(expirationDate);
  const sellBy = deriveSellByDate({
    sellByDate,
    expirationDate: expires,
    purchaseDate: purchased,
    sellByBufferDays: product.sellByBufferDays ?? 1,
  });

  if (sellBy > expires) {
    const err = new Error("Sell-by date cannot be after expiration date");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (purchased > expires) {
    const err = new Error("Purchase date cannot be after expiration date");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const lotCode =
    lotNumber?.trim() ||
    `LOT-${sku.skuCode}-${Date.now().toString(36).toUpperCase()}`;

  const existing = await StockLot.findOne({ tenantId, locationId, skuId, lotNumber: lotCode });
  if (existing) {
    const err = new Error("Lot number already exists for this SKU at this location");
    err.status = 409;
    err.code = "LOT_EXISTS";
    throw err;
  }

  const { balance } = await applyStockDelta({
    tenantId,
    locationId,
    skuId,
    qtyDelta: amount,
    type: "receive",
    referenceType: "food_lot",
    referenceId: lotCode,
    note: note ?? `Lot receive ${lotCode}`,
    createdBy,
  });

  const lot = await StockLot.create({
    tenantId,
    locationId,
    skuId,
    lotNumber: lotCode,
    purchaseDate: purchased,
    receivedAt: new Date(),
    expirationDate: expires,
    sellByDate: sellBy,
    qtyOnHand: amount,
    qtyReceived: amount,
    supplierName: supplierName?.trim() || undefined,
    unitCostCents: unitCostCents != null ? Number(unitCostCents) : undefined,
    status: "active",
  });

  return { lot, balance };
}

export async function listStockLots(tenantId, { locationId, skuId, status, expiringWithinDays } = {}) {
  const filter = { tenantId };
  if (locationId) filter.locationId = locationId;
  if (skuId) filter.skuId = skuId;
  if (status) filter.status = status;

  if (expiringWithinDays != null) {
    const days = Number(expiringWithinDays);
    const until = new Date();
    until.setDate(until.getDate() + days);
    filter.status = "active";
    filter.sellByDate = { $lte: until };
    filter.qtyOnHand = { $gt: 0 };
  }

  const lots = await StockLot.find(filter).sort({ sellByDate: 1, expirationDate: 1 });

  return Promise.all(
    lots.map(async (lot) => {
      const [sku, location, product] = await Promise.all([
        Sku.findById(lot.skuId),
        Location.findById(lot.locationId),
        Sku.findById(lot.skuId).then((s) => (s ? Product.findById(s.productId) : null)),
      ]);
      return {
        lot,
        sku,
        product,
        location,
        availability: lotAvailabilityStatus(lot),
      };
    }),
  );
}

export async function getLotSummaryForSku(tenantId, locationId, skuId) {
  const lots = await StockLot.find({
    tenantId,
    locationId,
    skuId,
    status: "active",
    qtyOnHand: { $gt: 0 },
  }).sort({ sellByDate: 1, expirationDate: 1 });

  const sellableLots = lots.filter((l) => lotAvailabilityStatus(l) === "ok" || lotAvailabilityStatus(l) === "expiring_soon");
  const nearest = sellableLots[0] ?? lots[0];

  return {
    lotCount: lots.length,
    sellableQty: sellableLots.reduce((s, l) => s + l.qtyOnHand, 0),
    nearestSellBy: nearest?.sellByDate,
    nearestExpiration: nearest?.expirationDate,
    expiringSoon: lots.some((l) => lotAvailabilityStatus(l) === "expiring_soon"),
    pastSellBy: lots.some((l) => lotAvailabilityStatus(l) === "past_sell_by"),
  };
}

/** FEFO: consume from lots with earliest sell-by first. */
export async function consumeLotsFEFO({
  tenantId,
  locationId,
  skuId,
  qty,
  referenceType,
  referenceId,
  createdBy,
}) {
  const amount = Number(qty);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("qty must be positive");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const lots = await StockLot.find({
    tenantId,
    locationId,
    skuId,
    status: "active",
    qtyOnHand: { $gt: 0 },
  }).sort({ sellByDate: 1, expirationDate: 1, receivedAt: 1 });

  let remaining = amount;
  const consumed = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const availability = lotAvailabilityStatus(lot);
    if (availability === "past_sell_by" || availability === "expired") continue;

    const take = Math.min(lot.qtyOnHand, remaining);
    lot.qtyOnHand -= take;
    if (lot.qtyOnHand === 0) lot.status = "depleted";
    await lot.save();
    consumed.push({ lotId: lot._id, lotNumber: lot.lotNumber, qty: take });
    remaining -= take;
  }

  if (remaining > 0) {
    const err = new Error("Insufficient sellable lot stock (check sell-by dates)");
    err.status = 400;
    err.code = "INSUFFICIENT_LOT_STOCK";
    throw err;
  }

  await applyStockDelta({
    tenantId,
    locationId,
    skuId,
    qtyDelta: -amount,
    type: "sale",
    referenceType,
    referenceId,
    note: `FEFO lot consume (${consumed.map((c) => c.lotNumber).join(", ")})`,
    createdBy,
  });

  return consumed;
}

export async function recordLotWastage({
  tenantId,
  lotId,
  qty,
  reason,
  createdBy,
}) {
  const lot = await StockLot.findOne({ _id: lotId, tenantId });
  if (!lot) {
    const err = new Error("Lot not found");
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const amount = Number(qty);
  if (!Number.isFinite(amount) || amount <= 0 || amount > lot.qtyOnHand) {
    const err = new Error("Invalid wastage quantity");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  lot.qtyOnHand -= amount;
  if (lot.qtyOnHand === 0) lot.status = "wasted";
  lot.wastageReason = reason?.trim() || lot.wastageReason;
  await lot.save();

  await applyStockDelta({
    tenantId,
    locationId: lot.locationId,
    skuId: lot.skuId,
    qtyDelta: -amount,
    type: "adjustment",
    referenceType: "wastage",
    referenceId: lot._id.toString(),
    note: reason ?? "Spoilage / wastage",
    createdBy,
  });

  await publishEvent({
    tenantId,
    eventName: "wastage.recorded",
    source: "fnb_inventory",
    idempotencyKey: `wastage-${lot._id}-${Date.now()}`,
    payload: {
      lotId: lot._id.toString(),
      lotNumber: lot.lotNumber,
      skuId: lot.skuId.toString(),
      locationId: lot.locationId.toString(),
      qty: amount,
      reason: reason ?? "wastage",
    },
  });

  return lot;
}

export async function markExpiredLots(tenantId) {
  const today = startOfDay(new Date());
  const expired = await StockLot.find({
    tenantId,
    status: "active",
    qtyOnHand: { $gt: 0 },
    expirationDate: { $lt: today },
  });

  for (const lot of expired) {
    const qty = lot.qtyOnHand;
    lot.qtyOnHand = 0;
    lot.status = "expired";
    await lot.save();

    await applyStockDelta({
      tenantId,
      locationId: lot.locationId,
      skuId: lot.skuId,
      qtyDelta: -qty,
      type: "adjustment",
      referenceType: "expiry",
      referenceId: lot._id.toString(),
      note: "Auto-expired lot write-off",
    });
  }

  return expired.length;
}
