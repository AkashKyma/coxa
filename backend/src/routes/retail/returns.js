import { Router } from "express";
import { RetailReturn } from "../../models/RetailReturn.js";
import { Location } from "../../models/Location.js";
import { createReturn } from "../../services/returnService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const filter = { tenantId: req.ctx.tenantId };
    if (req.query.saleId) filter.saleId = req.query.saleId;

    const returns = await RetailReturn.find(filter).sort({ createdAt: -1 }).limit(100);

    const data = await Promise.all(
      returns.map(async (ret) => {
        const location = await Location.findById(ret.locationId);
        return { return: ret, location };
      }),
    );

    res.json({ data, total: data.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { saleId, reason, lines } = req.body;
    if (!saleId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "saleId and lines are required",
      });
    }

    const retailReturn = await createReturn({
      tenantId: req.ctx.tenantId,
      saleId,
      reason,
      lines,
      createdBy: req.ctx.userId,
    });

    res.status(201).json({ data: retailReturn, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

export default router;
