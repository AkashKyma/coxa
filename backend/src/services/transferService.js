import { Location } from "../models/Location.js";
import { Sku } from "../models/Sku.js";
import { StockTransfer } from "../models/StockTransfer.js";
import { applyStockDelta } from "./stockService.js";
import { publishEvent } from "./cdp/cdpEventService.js";

export async function executeTransfer({
  tenantId,
  fromLocationId,
  toLocationId,
  lines,
  note,
  createdBy,
}) {
  if (fromLocationId === toLocationId) {
    const err = new Error("From and to locations must differ");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const [fromLoc, toLoc] = await Promise.all([
    Location.findOne({ _id: fromLocationId, tenantId }),
    Location.findOne({ _id: toLocationId, tenantId }),
  ]);

  if (!fromLoc || !toLoc) {
    const err = new Error("Invalid from or to location");
    err.status = 404;
    err.code = "LOCATION_NOT_FOUND";
    throw err;
  }

  const resolvedLines = [];
  for (const line of lines) {
    const qty = Number(line.qty);
    if (!line.skuId || !Number.isFinite(qty) || qty < 1) {
      const err = new Error("Each line needs skuId and qty >= 1");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    const sku = await Sku.findOne({ _id: line.skuId, tenantId, status: "active" });
    if (!sku) {
      const err = new Error(`SKU not found: ${line.skuId}`);
      err.status = 404;
      err.code = "SKU_NOT_FOUND";
      throw err;
    }
    resolvedLines.push({ skuId: sku._id, skuCode: sku.skuCode, qty });
  }

  const transferNumber = `TR-${Date.now()}`;
  const transfer = await StockTransfer.create({
    tenantId,
    transferNumber,
    fromLocationId,
    toLocationId,
    lines: resolvedLines,
    note: note?.trim(),
    status: "completed",
  });

  try {
    for (const line of resolvedLines) {
      await applyStockDelta({
        tenantId,
        locationId: fromLocationId,
        skuId: line.skuId,
        qtyDelta: -line.qty,
        type: "transfer",
        referenceType: "transfer_out",
        referenceId: transfer._id.toString(),
        note: `Transfer ${transferNumber} out`,
        createdBy,
      });
      await applyStockDelta({
        tenantId,
        locationId: toLocationId,
        skuId: line.skuId,
        qtyDelta: line.qty,
        type: "transfer",
        referenceType: "transfer_in",
        referenceId: transfer._id.toString(),
        note: `Transfer ${transferNumber} in`,
        createdBy,
      });
    }
  } catch (stockErr) {
    await StockTransfer.deleteOne({ _id: transfer._id });
    throw stockErr;
  }

  await publishEvent({
    tenantId,
    eventName: "stock.transferred",
    source: "inventory_service",
    idempotencyKey: `transfer-${transfer._id.toString()}`,
    eventTimestamp: transfer.createdAt,
    payload: {
      transferId: transfer._id.toString(),
      transferNumber: transfer.transferNumber,
      fromLocationId: fromLocationId.toString(),
      toLocationId: toLocationId.toString(),
      lineCount: resolvedLines.length,
      totalQty: resolvedLines.reduce((s, l) => s + l.qty, 0),
    },
  });

  return { transfer, fromLoc, toLoc };
}
