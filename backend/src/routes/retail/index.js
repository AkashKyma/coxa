import { Router } from "express";
import { TenantConfig } from "../../models/TenantConfig.js";
import { Sku } from "../../models/Sku.js";
import { Product } from "../../models/Product.js";
import { requireModule } from "../../middleware/requireModule.js";
import { getLocationCatalog } from "../../services/shopService.js";
import productsRouter from "./products.js";
import locationsRouter from "./locations.js";
import stockRouter from "./stock.js";
import salesRouter from "./sales.js";
import shopRouter from "./shop.js";
import alertsRouter from "./alerts.js";
import returnsRouter from "./returns.js";
import transfersRouter from "./transfers.js";
import categoriesRouter from "./categories.js";
import lotsRouter from "./lots.js";
import saleQrRouter from "./saleQr.js";
import analyticsRouter from "./analytics.js";

const router = Router();

router.get("/status", async (req, res, next) => {
  try {
    const config = await TenantConfig.findOne({ tenantId: req.ctx.tenantId });
    res.json({
      module: "retail",
      enabled: config?.enabledModules?.includes("retail") ?? false,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.use(requireModule("retail"));

router.get("/catalog", async (req, res, next) => {
  try {
    if (req.query.locationId) {
      const { location, items } = await getLocationCatalog(
        req.ctx.tenantId,
        req.query.locationId,
      );
      return res.json({
        data: items,
        location,
        total: items.length,
        tenantId: req.ctx.tenantId,
      });
    }

    const skus = await Sku.find({ tenantId: req.ctx.tenantId, status: "active" });
    const catalog = await Promise.all(
      skus.map(async (sku) => {
        const product = await Product.findById(sku.productId);
        return { sku, product };
      }),
    );
    res.json({ data: catalog, total: catalog.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/locations", locationsRouter);
router.use("/stock", stockRouter);
router.use("/shop", shopRouter);
router.use("/sales", salesRouter);
router.use("/returns", returnsRouter);
router.use("/transfers", transfersRouter);
router.use("/alerts", alertsRouter);
router.use("/lots", lotsRouter);
// SaleQr routes sit at /sales/:saleId/qr-codes and /sale-qr/redeem
router.use("/", saleQrRouter);
router.use("/analytics", analyticsRouter);

export default router;
