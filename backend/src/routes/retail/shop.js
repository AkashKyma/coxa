import { Router } from "express";
import { Sale } from "../../models/Sale.js";
import { createSale } from "../../services/saleService.js";
import { getShopCatalog, getOnlineLocation, resolveFanProfile } from "../../services/shopService.js";

const router = Router();

router.get("/catalog", async (req, res, next) => {
  try {
    const { location, items } = await getShopCatalog(req.ctx.tenantId);
    if (!location) {
      return res.status(503).json({
        code: "ONLINE_STORE_UNAVAILABLE",
        message: "Online shop location is not configured",
      });
    }
    res.json({
      data: { location, items },
      total: items.length,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/orders", async (req, res, next) => {
  try {
    const { lines, paymentMethod, fanUserId, fanEmail } = req.body;
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "lines are required",
      });
    }

    const online = await getOnlineLocation(req.ctx.tenantId);
    if (!online) {
      return res.status(503).json({
        code: "ONLINE_STORE_UNAVAILABLE",
        message: "Online shop location is not configured",
      });
    }

    const fan = await resolveFanProfile(req.ctx.tenantId, {
      fanProfileId: req.body.fanProfileId,
      fanUserId: fanUserId ?? req.ctx.userId,
      fanEmail,
    });

    const sale = await createSale({
      tenantId: req.ctx.tenantId,
      locationId: online._id,
      lines,
      paymentMethod: paymentMethod ?? "stub",
      fanProfileId: fan?._id,
      channel: "fan_shop",
      saleNumberPrefix: "FS",
    });

    res.status(201).json({
      data: {
        sale,
        fan: fan
          ? { id: fan.id, fanId: fan.fanId, name: fan.fullName, email: fan.email }
          : null,
      },
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    const fan = await resolveFanProfile(req.ctx.tenantId, {
      fanProfileId: req.query.fanProfileId,
      fanUserId: req.query.fanUserId ?? req.ctx.userId,
      fanEmail: req.query.fanEmail,
    });

    const filter = {
      tenantId: req.ctx.tenantId,
      channel: "fan_shop",
      status: "completed",
    };
    if (fan) filter.fanProfileId = fan._id;

    const sales = await Sale.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({
      data: sales,
      total: sales.length,
      fan: fan
        ? { id: fan.id, fanId: fan.fanId, name: fan.fullName, email: fan.email }
        : null,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
