import { Router } from "express";
import { StockTransfer } from "../../models/StockTransfer.js";
import { Location } from "../../models/Location.js";
import { executeTransfer } from "../../services/transferService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const transfers = await StockTransfer.find({ tenantId: req.ctx.tenantId })
      .sort({ createdAt: -1 })
      .limit(100);

    const data = await Promise.all(
      transfers.map(async (t) => {
        const [from, to] = await Promise.all([
          Location.findById(t.fromLocationId),
          Location.findById(t.toLocationId),
        ]);
        return { transfer: t, from, to };
      }),
    );

    res.json({ data, total: data.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { fromLocationId, toLocationId, lines, note } = req.body;
    if (!fromLocationId || !toLocationId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fromLocationId, toLocationId and lines are required",
      });
    }

    const { transfer, from, to } = await executeTransfer({
      tenantId: req.ctx.tenantId,
      fromLocationId,
      toLocationId,
      lines,
      note,
      createdBy: req.ctx.userId,
    });

    res.status(201).json({
      data: { transfer, from, to },
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
