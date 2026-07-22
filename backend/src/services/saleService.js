import { Sale } from "../models/Sale.js";
import { Sku } from "../models/Sku.js";
import { Product } from "../models/Product.js";
import { Location } from "../models/Location.js";
import { applyStockDelta } from "./stockService.js";
import { consumeLotsFEFO } from "./foodLotService.js";
import { publishEvent } from "./cdp/cdpEventService.js";
import { generateSaleLineQrs } from "./saleQrService.js";

export async function createSale({
  tenantId,
  locationId,
  lines,
  paymentMethod = "cash",
  fanProfileId,
  fanUserId,
  cashierUserId,
  channel = "pos",
  saleNumberPrefix = "RS",
}) {
  const location = await Location.findOne({ _id: locationId, tenantId });
  if (!location) {
    const err = new Error("Location not found");
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
    const product = await Product.findById(sku.productId);
    resolvedLines.push({
      skuId: sku._id,
      skuCode: sku.skuCode,
      productName: product?.name ?? sku.skuCode,
      trackLots: Boolean(product?.trackLots),
      qty,
      unitPriceCents: sku.priceCents,
      lineTotalCents: sku.priceCents * qty,
    });
  }

  const subtotalCents = resolvedLines.reduce((s, l) => s + l.lineTotalCents, 0);
  const saleNumber = `${saleNumberPrefix}-${Date.now()}`;

  const sale = await Sale.create({
    tenantId,
    saleNumber,
    locationId,
    lines: resolvedLines,
    subtotalCents,
    totalCents: subtotalCents,
    paymentStatus: "paid",
    paymentMethod,
    fanProfileId: fanProfileId || undefined,
    fanUserId: fanUserId || undefined,
    cashierUserId,
    channel,
    status: "completed",
  });

  try {
    for (const line of resolvedLines) {
      if (line.trackLots) {
        await consumeLotsFEFO({
          tenantId,
          locationId,
          skuId: line.skuId,
          qty: line.qty,
          referenceType: "sale",
          referenceId: sale._id.toString(),
          createdBy: cashierUserId,
        });
      } else {
        await applyStockDelta({
          tenantId,
          locationId,
          skuId: line.skuId,
          qtyDelta: -line.qty,
          type: "sale",
          referenceType: "sale",
          referenceId: sale._id.toString(),
          note: `Sale ${saleNumber}`,
          createdBy: cashierUserId,
        });
      }
    }
  } catch (stockErr) {
    await Sale.deleteOne({ _id: sale._id });
    throw stockErr;
  }

  if (sale.fanProfileId) {
    await publishEvent({
      tenantId,
      eventName: "sale.completed",
      source: channel === "fan_shop" ? "fan_shop" : "retail_pos",
      fanProfileId: sale.fanProfileId,
      idempotencyKey: `sale-${sale._id.toString()}`,
      eventTimestamp: sale.createdAt,
      payload: {
        saleId: sale._id.toString(),
        saleNumber: sale.saleNumber,
        totalCents: sale.totalCents,
        subtotalCents: sale.subtotalCents,
        channel: sale.channel,
        locationId: sale.locationId.toString(),
        paymentMethod: sale.paymentMethod,
        lineCount: sale.lines.length,
      },
    });
  }

  // Generate per-unit QR tokens for physical product redemption (non-blocking)
  generateSaleLineQrs(sale).catch((err) =>
    console.error("[saleService] generateSaleLineQrs failed:", err.message),
  );

  return sale;
}
