import { Router } from "express";
import { validateEntitlement, manualOverrideEntitlement } from "../../services/entitlementService.js";

const router = Router();

router.get("/validate", async (req, res, next) => {
  try {
    const qrToken = req.query.qrToken ?? req.query.qr;
    if (!qrToken) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "qrToken query parameter is required",
      });
    }

    const result = await validateEntitlement({
      tenantId: req.ctx.tenantId,
      qrToken,
      gateId: req.query.gateId,
      deviceId: req.query.deviceId,
      markUsed: req.query.markUsed === "true",
      matchEventId: req.query.matchEventId,
    });

    res.json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/validate", async (req, res, next) => {
  try {
    const result = await validateEntitlement({
      tenantId: req.ctx.tenantId,
      qrToken: req.body.qrToken,
      gateId: req.body.gateId,
      deviceId: req.body.deviceId,
      markUsed: req.body.markUsed ?? false,
      matchEventId: req.body.matchEventId,
    });
    res.json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/override", async (req, res, next) => {
  try {
    const result = await manualOverrideEntitlement({
      tenantId: req.ctx.tenantId,
      qrToken: req.body.qrToken,
      fanProfileId: req.body.fanProfileId,
      matchEventId: req.body.matchEventId,
      gateId: req.body.gateId,
      reason: req.body.reason,
      overrideBy: req.body.overrideBy ?? req.user?.id,
    });
    res.json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
