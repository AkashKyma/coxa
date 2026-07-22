import { Router } from "express";
import { getSaleQrCodes, redeemSaleQr } from "../../services/saleQrService.js";
import { Sale } from "../../models/Sale.js";

const router = Router();

/**
 * GET /api/v1/retail/sales/:saleId/qr-codes
 * Returns all QR token records for a sale, grouped by line.
 */
router.get("/sales/:saleId/qr-codes", async (req, res, next) => {
  try {
    const { tenantId } = req.ctx;
    const { saleId } = req.params;

    // Verify the sale belongs to this tenant
    const sale = await Sale.findOne({ _id: saleId, tenantId }).lean();
    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const qrDocs = await getSaleQrCodes(tenantId, saleId);

    // Group by line index for ergonomic frontend consumption
    const byLine = {};
    for (const doc of qrDocs) {
      const idx = doc.saleLineIndex;
      if (!byLine[idx]) {
        byLine[idx] = {
          saleLineIndex: idx,
          productName: doc.productName,
          skuId: doc.skuId,
          tokens: [],
        };
      }
      byLine[idx].tokens.push({
        qrToken: doc.qrToken,
        unitIndex: doc.unitIndex,
        status: doc.status,
        redeemedAt: doc.redeemedAt,
      });
    }

    res.json({
      data: {
        saleId,
        saleNumber: sale.saleNumber,
        lines: Object.values(byLine).sort((a, b) => a.saleLineIndex - b.saleLineIndex),
        totalTokens: qrDocs.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/retail/sale-qr/redeem
 * Marks a single QR token as redeemed.
 * Body: { qrToken: string }
 */
router.post("/sale-qr/redeem", async (req, res, next) => {
  try {
    const { tenantId, userId } = req.ctx;
    const { qrToken } = req.body ?? {};

    if (!qrToken || typeof qrToken !== "string") {
      return res.status(400).json({ error: "qrToken is required" });
    }

    const doc = await redeemSaleQr(tenantId, qrToken.trim(), userId);

    res.json({
      data: {
        qrToken: doc.qrToken,
        status: doc.status,
        productName: doc.productName,
        saleId: doc.saleId,
        redeemedAt: doc.redeemedAt,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

export default router;
