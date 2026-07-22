import { Router } from "express";
import { StockBalance } from "../../models/StockBalance.js";
import { Sku } from "../../models/Sku.js";
import { Product } from "../../models/Product.js";
import { Location } from "../../models/Location.js";

const router = Router();

router.get("/low-stock", async (req, res, next) => {
  try {
    const balances = await StockBalance.find({ tenantId: req.ctx.tenantId });
    const alerts = [];

    for (const balance of balances) {
      const sku = await Sku.findById(balance.skuId);
      if (!sku || sku.minQty <= 0) continue;
      if (balance.qtyOnHand > sku.minQty) continue;

      const [product, location] = await Promise.all([
        Product.findById(sku.productId),
        Location.findById(balance.locationId),
      ]);

      alerts.push({
        sku,
        product,
        location,
        qtyOnHand: balance.qtyOnHand,
        minQty: sku.minQty,
      });
    }

    res.json({ data: alerts, total: alerts.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
