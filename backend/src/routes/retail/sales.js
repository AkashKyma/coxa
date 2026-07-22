import { Router } from "express";
import { Sale } from "../../models/Sale.js";
import { Location } from "../../models/Location.js";
import { createSale } from "../../services/saleService.js";

const router = Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get("/", async (req, res, next) => {
  try {
    const filter = { tenantId: req.ctx.tenantId, status: "completed" };
    if (req.query.today === "true") {
      filter.createdAt = { $gte: startOfToday() };
    }
    if (req.query.locationId) filter.locationId = req.query.locationId;
    if (req.query.channel) filter.channel = req.query.channel;

    const sales = await Sale.find(filter).sort({ createdAt: -1 }).limit(200);

    const data = await Promise.all(
      sales.map(async (sale) => {
        const location = await Location.findById(sale.locationId);
        return { sale, location };
      }),
    );

    res.json({ data, total: data.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, tenantId: req.ctx.tenantId });
    if (!sale) {
      return res.status(404).json({ code: "SALE_NOT_FOUND", message: "Sale not found" });
    }
    const location = await Location.findById(sale.locationId);
    res.json({ data: { sale, location }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { locationId, lines, paymentMethod, fanProfileId, fanEmail } = req.body;

    if (!locationId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "locationId and lines are required",
      });
    }

    let resolvedFanProfileId = fanProfileId;
    if (!resolvedFanProfileId && fanEmail) {
      const { resolveFanProfile } = await import("../../services/shopService.js");
      const fan = await resolveFanProfile(req.ctx.tenantId, { fanEmail });
      resolvedFanProfileId = fan?._id;
    }

    const sale = await createSale({
      tenantId: req.ctx.tenantId,
      locationId,
      lines,
      paymentMethod: paymentMethod ?? "cash",
      fanProfileId: resolvedFanProfileId,
      cashierUserId: req.ctx.userId,
      channel: "pos",
      saleNumberPrefix: "RS",
    });

    res.status(201).json({ data: sale, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

export default router;
