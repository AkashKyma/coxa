import crypto from "crypto";
import { SaleLineQr } from "../models/SaleLineQr.js";

/**
 * Generates one QR token per unit within each sale line and persists them.
 * Called once immediately after a Sale document is created.
 *
 * @param {object} sale  - Mongoose Sale document
 * @returns {Promise<SaleLineQr[]>} The created QR records
 */
export async function generateSaleLineQrs(sale) {
  const docs = [];
  for (let lineIdx = 0; lineIdx < sale.lines.length; lineIdx++) {
    const line = sale.lines[lineIdx];
    const qty = Number(line.qty ?? 1);
    for (let unit = 0; unit < qty; unit++) {
      docs.push({
        tenantId: sale.tenantId,
        saleId: sale._id,
        saleLineIndex: lineIdx,
        skuId: line.skuId,
        productName: line.productName ?? "",
        unitIndex: unit,
        qrToken: crypto.randomBytes(16).toString("hex"),
        status: "issued",
      });
    }
  }
  if (!docs.length) return [];
  return SaleLineQr.insertMany(docs, { ordered: false });
}

/**
 * Retrieves all QR records for a given sale.
 *
 * @param {string} tenantId
 * @param {string} saleId
 * @returns {Promise<SaleLineQr[]>}
 */
export async function getSaleQrCodes(tenantId, saleId) {
  return SaleLineQr.find({ tenantId, saleId }).sort({ saleLineIndex: 1, unitIndex: 1 }).lean();
}

/**
 * Marks a single QR token as redeemed.
 * Throws if: token not found, wrong tenant, already redeemed, or voided.
 *
 * @param {string} tenantId
 * @param {string} qrToken
 * @param {string} [userId]   - The staff member who redeemed it (optional)
 * @returns {Promise<SaleLineQr>} The updated document
 */
export async function redeemSaleQr(tenantId, qrToken, userId) {
  const doc = await SaleLineQr.findOne({ qrToken, tenantId });
  if (!doc) {
    const err = new Error("QR code not found");
    err.status = 404;
    err.code = "QR_NOT_FOUND";
    throw err;
  }
  if (doc.status === "redeemed") {
    const err = new Error(`Already redeemed at ${doc.redeemedAt?.toISOString()}`);
    err.status = 409;
    err.code = "ALREADY_REDEEMED";
    throw err;
  }
  if (doc.status === "voided") {
    const err = new Error("QR code is voided");
    err.status = 409;
    err.code = "QR_VOIDED";
    throw err;
  }
  doc.status = "redeemed";
  doc.redeemedAt = new Date();
  if (userId) doc.redeemedByUserId = userId;
  await doc.save();
  return doc;
}
