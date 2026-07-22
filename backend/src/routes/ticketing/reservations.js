import { Router } from "express";
import { createReservation, cancelReservation, getReservation } from "../../services/reservationService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const idempotencyKey =
      req.body.idempotencyKey ?? req.headers["idempotency-key"] ?? `res-${Date.now()}`;
    const result = await createReservation({
      tenantId: req.ctx.tenantId,
      matchEventId: req.body.matchEventId,
      lines: req.body.lines,
      fanProfileId: req.body.fanProfileId,
      fanEmail: req.body.fanEmail,
      channel: req.body.channel ?? "fan_app",
      idempotencyKey,
    });
    res.status(result.duplicate ? 200 : 201).json({
      data: result.reservation,
      duplicate: result.duplicate,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const reservation = await getReservation(req.ctx.tenantId, req.params.id);
    res.json({ data: reservation, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const reservation = await cancelReservation(req.ctx.tenantId, req.params.id);
    res.json({ data: reservation, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
