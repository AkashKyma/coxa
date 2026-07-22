import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireModule } from "../../middleware/requireModule.js";
import {
  getOrCreateReferralCode,
  redeemReferralCode,
  listReferrals,
} from "../../services/referralService.js";
import { FanProfile } from "../../models/FanProfile.js";

const router = Router();

router.use(requireModule("membership"));

async function resolveFanProfile(req, res) {
  const profile = await FanProfile.findOne({
    tenantId: req.ctx.tenantId,
    userId: req.user._id,
  });
  if (!profile) {
    res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    return null;
  }
  return profile;
}

// GET /api/v1/membership/referrals/code — get or generate my shareable code
router.get("/code", requireAuth, async (req, res, next) => {
  try {
    const profile = await resolveFanProfile(req, res);
    if (!profile) return;
    const code = await getOrCreateReferralCode(req.ctx.tenantId, profile._id);
    res.json({ data: { referralCode: code }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/membership/referrals/redeem — use someone else's code
router.post("/redeem", requireAuth, async (req, res, next) => {
  try {
    const profile = await resolveFanProfile(req, res);
    if (!profile) return;
    const { referralCode: code } = req.body;
    if (!code) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "referralCode is required" });
    }
    const referral = await redeemReferralCode(req.ctx.tenantId, profile._id, code);
    res.status(201).json({ data: referral, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/membership/referrals — my outbound referrals list
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const profile = await resolveFanProfile(req, res);
    if (!profile) return;
    const referrals = await listReferrals(req.ctx.tenantId, profile._id);
    res.json({ data: referrals, total: referrals.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
