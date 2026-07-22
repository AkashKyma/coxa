import { Router } from "express";
import {
  listStockLots,
  receiveStockLot,
  recordLotWastage,
  markExpiredLots,
} from "../../services/foodLotService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { locationId, skuId, status, expiringWithinDays } = req.query;
    const rows = await listStockLots(req.ctx.tenantId, {
      locationId,
      skuId,
      status,
      expiringWithinDays: expiringWithinDays != null ? Number(expiringWithinDays) : undefined,
    });
    res.json({
      data: rows.map(({ lot, sku, product, location, availability }) => ({
        ...lot.toJSON(),
        skuCode: sku?.skuCode,
        productName: product?.name,
        locationName: location?.name,
        locationCode: location?.code,
        availability,
      })),
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/receive", async (req, res, next) => {
  try {
    const {
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
    } = req.body;

    const result = await receiveStockLot({
      tenantId: req.ctx.tenantId,
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
      createdBy: req.user?.id,
    });

    res.status(201).json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/:lotId/wastage", async (req, res, next) => {
  try {
    const { qty, reason } = req.body;
    const lot = await recordLotWastage({
      tenantId: req.ctx.tenantId,
      lotId: req.params.lotId,
      qty,
      reason,
      createdBy: req.user?.id,
    });
    res.json({ data: { lot }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/mark-expired", async (req, res, next) => {
  try {
    const count = await markExpiredLots(req.ctx.tenantId);
    res.json({ data: { markedExpired: count }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
