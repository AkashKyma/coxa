import { Sale } from "../models/Sale.js";
import { RetailReturn } from "../models/RetailReturn.js";
import { Sku } from "../models/Sku.js";
import { Product } from "../models/Product.js";
import { applyStockDelta } from "./stockService.js";
import { publishEvent } from "./cdp/cdpEventService.js";

export async function createReturn({ tenantId, saleId, reason, lines, createdBy }) {
  const sale = await Sale.findOne({ _id: saleId, tenantId, status: "completed" });
  if (!sale) {
    const err = new Error("Sale not found");
    err.status = 404;
    err.code = "SALE_NOT_FOUND";
    throw err;
  }

  const priorReturns = await RetailReturn.find({ tenantId, saleId, status: "completed" });
  const returnedBySku = new Map();
  for (const r of priorReturns) {
    for (const line of r.lines) {
      const key = line.skuId.toString();
      returnedBySku.set(key, (returnedBySku.get(key) ?? 0) + line.qty);
    }
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

    const saleLine = sale.lines.find((l) => l.skuId.toString() === line.skuId.toString());
    if (!saleLine) {
      const err = new Error(`SKU was not on original sale: ${line.skuId}`);
      err.status = 400;
      err.code = "INVALID_RETURN_LINE";
      throw err;
    }

    const already = returnedBySku.get(line.skuId.toString()) ?? 0;
    if (already + qty > saleLine.qty) {
      const err = new Error(`Return qty exceeds sold qty for ${saleLine.skuCode}`);
      err.status = 400;
      err.code = "RETURN_QTY_EXCEEDED";
      throw err;
    }

    const sku = await Sku.findOne({ _id: line.skuId, tenantId });
    const product = sku ? await Product.findById(sku.productId) : null;

    resolvedLines.push({
      skuId: saleLine.skuId,
      skuCode: saleLine.skuCode,
      productName: product?.name ?? saleLine.productName,
      qty,
      unitPriceCents: saleLine.unitPriceCents,
      lineTotalCents: saleLine.unitPriceCents * qty,
    });
  }

  const totalCents = resolvedLines.reduce((s, l) => s + l.lineTotalCents, 0);
  const returnNumber = `RET-${Date.now()}`;

  const retailReturn = await RetailReturn.create({
    tenantId,
    returnNumber,
    saleId: sale._id,
    saleNumber: sale.saleNumber,
    locationId: sale.locationId,
    reason: reason?.trim(),
    lines: resolvedLines,
    totalCents,
    status: "completed",
  });

  try {
    for (const line of resolvedLines) {
      await applyStockDelta({
        tenantId,
        locationId: sale.locationId,
        skuId: line.skuId,
        qtyDelta: line.qty,
        type: "return",
        referenceType: "return",
        referenceId: retailReturn._id.toString(),
        note: `Return ${returnNumber} for ${sale.saleNumber}`,
        createdBy,
      });
    }
  } catch (stockErr) {
    await RetailReturn.deleteOne({ _id: retailReturn._id });
    throw stockErr;
  }

  if (sale.fanProfileId) {
    await publishEvent({
      tenantId,
      eventName: "sale.returned",
      source: "retail_pos",
      fanProfileId: sale.fanProfileId,
      idempotencyKey: `return-${retailReturn._id.toString()}`,
      eventTimestamp: retailReturn.createdAt,
      payload: {
        returnId: retailReturn._id.toString(),
        returnNumber: retailReturn.returnNumber,
        saleId: sale._id.toString(),
        saleNumber: sale.saleNumber,
        totalCents: retailReturn.totalCents,
      },
    });
  }

  return retailReturn;
}
