/**
 * Push notification routes
 * POST /api/v1/push/register  — store device token for authenticated fan
 * DELETE /api/v1/push/token   — remove device token
 * GET  /api/v1/push/vapid-key — return VAPID public key for browser subscription
 */
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { registerPushToken, removePushToken, getVapidPublicKey } from "../../services/pushService.js";
import { FanProfile } from "../../models/FanProfile.js";

const router = Router();

router.get("/vapid-key", (_req, res) => {
  const key = getVapidPublicKey();
  res.json({ vapidPublicKey: key, enabled: !!key });
});

router.post("/register", requireAuth, async (req, res, next) => {
  try {
    const { token, type, userAgent } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
    const fan = await FanProfile.findOne({ userId: req.user._id, tenantId, status: "active" });
    if (!fan) return res.status(404).json({ message: "Fan profile not found" });

    await registerPushToken({ fanProfileId: fan._id, token, type, userAgent });
    res.json({ message: "Push token registered" });
  } catch (err) {
    next(err);
  }
});

router.delete("/token", requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
    const fan = await FanProfile.findOne({ userId: req.user._id, tenantId, status: "active" });
    if (!fan) return res.status(404).json({ message: "Fan profile not found" });

    await removePushToken({ fanProfileId: fan._id, token });
    res.json({ message: "Push token removed" });
  } catch (err) {
    next(err);
  }
});

export default router;
