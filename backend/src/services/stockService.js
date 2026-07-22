import { StockBalance } from "../models/StockBalance.js";
import { StockLedgerEntry } from "../models/StockLedgerEntry.js";
import { Sku } from "../models/Sku.js";
import { Location } from "../models/Location.js";

/**
 * Apply a stock quantity change and append an immutable ledger entry.
 * Uses sequential writes (no multi-doc transaction) for standalone MongoDB.
 */
export async function applyStockDelta({
  tenantId,
  locationId,
  skuId,
  qtyDelta,
  type,
  referenceType,
  referenceId,
  note,
  createdBy,
}) {
  const [sku, location] = await Promise.all([
    Sku.findOne({ _id: skuId, tenantId }),
    Location.findOne({ _id: locationId, tenantId }),
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

  let balance = await StockBalance.findOne({ tenantId, locationId, skuId });

  if (!balance) {
    if (qtyDelta < 0) {
      const err = new Error("Insufficient stock");
      err.status = 400;
      err.code = "INSUFFICIENT_STOCK";
      throw err;
    }
    try {
      balance = await StockBalance.create({ tenantId, locationId, skuId, qtyOnHand: 0 });
    } catch (err) {
      if (err.code !== 11000) throw err;
      balance = await StockBalance.findOne({ tenantId, locationId, skuId });
      if (!balance) throw err;
    }
  }

  const newQty = balance.qtyOnHand + qtyDelta;
  if (newQty < 0) {
    const err = new Error("Insufficient stock");
    err.status = 400;
    err.code = "INSUFFICIENT_STOCK";
    throw err;
  }

  balance.qtyOnHand = newQty;
  await balance.save();

  const ledgerEntry = await StockLedgerEntry.create({
    tenantId,
    locationId,
    skuId,
    type,
    qtyDelta,
    balanceAfter: newQty,
    referenceType,
    referenceId,
    note,
    createdBy,
  });

  return { balance, ledgerEntry };
}

/** Create 0-qty balance rows at every active location so the SKU appears in Stock. */
export async function ensureSkuStockPlaces(tenantId, skuId) {
  const locations = await Location.find({ tenantId, status: "active" });
  const created = [];
  for (const location of locations) {
    const exists = await StockBalance.findOne({
      tenantId,
      locationId: location._id,
      skuId,
    });
    if (!exists) {
      try {
        const balance = await StockBalance.create({
          tenantId,
          locationId: location._id,
          skuId,
          qtyOnHand: 0,
        });
        created.push(balance);
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
  }
  return created;
}

/** Receive stock (positive qty) into a location. */
export async function receiveStock({
  tenantId,
  locationId,
  skuId,
  qty,
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
  return applyStockDelta({
    tenantId,
    locationId,
    skuId,
    qtyDelta: amount,
    type: "receive",
    referenceType: "receive",
    note,
    createdBy,
  });
}
