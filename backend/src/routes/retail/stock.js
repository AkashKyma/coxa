import { Router } from "express";
import { StockBalance } from "../../models/StockBalance.js";
import { Sku } from "../../models/Sku.js";
import { Product } from "../../models/Product.js";
import { Location } from "../../models/Location.js";
import { applyStockDelta, ensureSkuStockPlaces, receiveStock } from "../../services/stockService.js";

const router = Router();

router.post("/sync-catalog", async (req, res, next) => {
  try {
    const skus = await Sku.find({ tenantId: req.ctx.tenantId, status: "active" });
    let places = 0;
    for (const sku of skus) {
      const created = await ensureSkuStockPlaces(req.ctx.tenantId, sku._id);
      places += created.length;
    }
    res.json({
      data: { skusProcessed: skus.length, balanceRowsCreated: places },
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = { tenantId: req.ctx.tenantId };
    if (req.query.locationId) filter.locationId = req.query.locationId;

    const balances = await StockBalance.find(filter).sort({ updatedAt: -1 });

    const rows = await Promise.all(
      balances.map(async (balance) => {
        const sku = await Sku.findById(balance.skuId);
        const [location, product] = await Promise.all([
          Location.findById(balance.locationId),
          sku ? Product.findById(sku.productId) : null,
        ]);
        return {
          id: balance.id,
          qtyOnHand: balance.qtyOnHand,
          sku,
          product,
          location,
        };
      }),
    );

    res.json({ data: rows, total: rows.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/receive", async (req, res, next) => {
  try {
    const { locationId, skuId, qty, note } = req.body;
    if (!locationId || !skuId || qty == null) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "locationId, skuId and qty are required",
      });
    }

    await ensureSkuStockPlaces(req.ctx.tenantId, skuId);

    const { balance, ledgerEntry } = await receiveStock({
      tenantId: req.ctx.tenantId,
      locationId,
      skuId,
      qty,
      note: note?.trim(),
      createdBy: req.ctx.userId,
    });

    res.status(201).json({
      data: { balance, ledgerEntry },
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        code: "STOCK_BALANCE_EXISTS",
        message: "Stock balance already exists for this product and location. Please refresh and try again.",
      });
    }
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.post("/adjustments", async (req, res, next) => {
  try {
    const { locationId, skuId, qtyDelta, note } = req.body;
    if (!locationId || !skuId || qtyDelta == null) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "locationId, skuId and qtyDelta are required",
      });
    }

    const delta = Number(qtyDelta);
    if (Number.isNaN(delta) || delta === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "qtyDelta must be a non-zero number",
      });
    }

    const { balance, ledgerEntry } = await applyStockDelta({
      tenantId: req.ctx.tenantId,
      locationId,
      skuId,
      qtyDelta: delta,
      type: "adjustment",
      referenceType: "adjustment",
      note: note?.trim(),
      createdBy: req.ctx.userId,
    });

    res.status(201).json({
      data: { balance, ledgerEntry },
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

export default router;
