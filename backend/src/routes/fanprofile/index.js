/**
 * Fan self-service profile route
 * PATCH /api/v1/fanprofile/me — fan can update their own profile fields
 */
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { FanProfile } from "../../models/FanProfile.js";

const router = Router();

const ALLOWED_FIELDS = [
  "fullName", "phone", "gender", "birthDate",
  "address", "preferredSocialNetwork",
];

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
    const fan = await FanProfile.findOne({ userId: req.user._id, tenantId, status: "active" });
    if (!fan) return res.status(404).json({ message: "Fan profile not found" });

    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    Object.assign(fan, updates);
    await fan.save();

    res.json({ data: fan, message: "Profile updated" });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
    const fan = await FanProfile.findOne({ userId: req.user._id, tenantId, status: "active" });
    if (!fan) return res.status(404).json({ message: "Fan profile not found" });
    res.json({ data: fan });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/fanprofile/unsubscribe
 * Public endpoint (no auth required) — called from unsubscribe links in emails.
 * Marks the fan as unsubscribed from marketing emails.
 */
router.post("/unsubscribe", async (req, res) => {
  try {
    const { fan: fanId, campaign: _campaign } = req.query;
    if (!fanId) return res.status(400).json({ message: "Missing fan param" });
    await FanProfile.updateOne(
      { _id: fanId },
      { $set: { emailOptOut: true, emailOptOutAt: new Date() } }
    );
    res.json({ message: "Unsubscribed" });
  } catch {
    res.json({ message: "Unsubscribed" });
  }
});

export default router;
