import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/requireAuth.js";
import { requireModule } from "../../middleware/requireModule.js";
import {
  createMembership,
  renewMembership,
  upgradeMembership,
  cancelMembership,
  getMembershipStatus,
  listMemberships,
  getMembershipById,
} from "../../services/fanMembershipService.js";
import {
  createMembershipPlan as createPlan,
  listMembershipPlans,
} from "../../services/membershipCheckInService.js";
import { MembershipPlan } from "../../models/MembershipPlan.js";
import { FanProfile } from "../../models/FanProfile.js";
import { FanMembership } from "../../models/FanMembership.js";
import { getScoreBreakdown, getTierThresholds, recalculateFanScore } from "../../services/fanScoreService.js";
import { recomputeDerivedTraits } from "../../services/traitCalculator.js";
import { getPriorityRanking } from "../../services/priorityEngineService.js";

const router = Router();

// Idempotency key can come from the Idempotency-Key header OR req.body
function idempotencyKey(req) {
  return req.headers["idempotency-key"] ?? req.body?.idempotencyKey ?? undefined;
}

// ── Module gate ────────────────────────────────────────────────────────────────
router.use(requireModule("membership"));

// ── Plan endpoints (public read, admin write) ──────────────────────────────────

router.get("/plans", async (req, res, next) => {
  try {
    const plans = await listMembershipPlans(req.ctx.tenantId);
    res.json({ data: plans, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/plans/:planCode", async (req, res, next) => {
  try {
    const plan = await MembershipPlan.findOne({
      tenantId: req.ctx.tenantId,
      planCode: req.params.planCode,
    });
    if (!plan) {
      return res.status(404).json({ code: "PLAN_NOT_FOUND", message: "Plan not found" });
    }
    res.json({ data: plan, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/plans", requireAuth, requireRole("admin", "owner"), async (req, res, next) => {
  try {
    const existing = await MembershipPlan.findOne({
      tenantId: req.ctx.tenantId,
      planCode: req.body.planCode,
    });
    const plan = await createPlan(req.ctx.tenantId, req.body);
    res.status(existing ? 200 : 201).json({ data: plan, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.put("/plans/:planCode", requireAuth, requireRole("admin", "owner"), async (req, res, next) => {
  try {
    const plan = await createPlan(req.ctx.tenantId, {
      ...req.body,
      planCode: req.params.planCode,
    });
    if (!plan) {
      return res.status(404).json({ code: "PLAN_NOT_FOUND", message: "Plan not found" });
    }
    res.json({ data: plan, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// ── Tier info (public) ─────────────────────────────────────────────────────────

router.get("/tiers", (_req, res) => {
  res.json({ data: getTierThresholds() });
});

// ── Fan self-service endpoints (requires auth) ─────────────────────────────────

router.post("/join", requireAuth, async (req, res, next) => {
  try {
    const { planCode, paymentFrequency, paymentMethod } = req.body;

    const profile = await FanProfile.findOne({ tenantId: req.ctx.tenantId, userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }

    const membership = await createMembership({
      tenantId: req.ctx.tenantId,
      fanProfileId: profile._id,
      planCode,
      paymentFrequency,
      paymentMethod,
      idempotencyKey: idempotencyKey(req),
    });
    res.status(201).json({ data: membership, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/renew", requireAuth, async (req, res, next) => {
  try {
    const { paymentFrequency, paymentMethod } = req.body;

    const profile = await FanProfile.findOne({ tenantId: req.ctx.tenantId, userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }
    const active = await FanMembership.findOne({ tenantId: req.ctx.tenantId, fanProfileId: profile._id, status: "active" });
    if (!active) {
      return res.status(404).json({ code: "MEMBERSHIP_NOT_FOUND", message: "No active membership found" });
    }

    const membership = await renewMembership({
      tenantId: req.ctx.tenantId,
      membershipId: active._id,
      paymentFrequency,
      paymentMethod,
      idempotencyKey: idempotencyKey(req),
    });
    res.json({ data: membership, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/upgrade", requireAuth, async (req, res, next) => {
  try {
    const { newPlanCode, paymentFrequency, paymentMethod } = req.body;

    const profile = await FanProfile.findOne({ tenantId: req.ctx.tenantId, userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }
    const active = await FanMembership.findOne({ tenantId: req.ctx.tenantId, fanProfileId: profile._id, status: "active" });
    if (!active) {
      return res.status(404).json({ code: "MEMBERSHIP_NOT_FOUND", message: "No active membership found" });
    }

    const membership = await upgradeMembership({
      tenantId: req.ctx.tenantId,
      membershipId: active._id,
      newPlanCode,
      paymentFrequency,
      paymentMethod,
      idempotencyKey: idempotencyKey(req),
    });
    res.json({ data: membership, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/cancel", requireAuth, async (req, res, next) => {
  try {
    // Try tenant-scoped lookup first; fall back to any active profile for this user
    let profile = await FanProfile.findOne({ tenantId: req.ctx.tenantId, userId: req.user._id });
    if (!profile) {
      profile = await FanProfile.findOne({ userId: req.user._id, status: "active" }).sort({ createdAt: -1 });
    }
    if (!profile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }
    const active = await FanMembership.findOne({ tenantId: profile.tenantId, fanProfileId: profile._id, status: "active" });
    if (!active) {
      return res.status(404).json({ code: "MEMBERSHIP_NOT_FOUND", message: "No active membership found" });
    }

    const membership = await cancelMembership({
      tenantId: profile.tenantId,
      membershipId: active._id,
      idempotencyKey: idempotencyKey(req),
    });
    res.json({ data: membership, tenantId: profile.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const profile = await FanProfile.findOne({ tenantId: req.ctx.tenantId, userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }
    const status = await getMembershipStatus(req.ctx.tenantId, profile._id);
    res.json({ data: status, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/me/score", requireAuth, async (req, res, next) => {
  try {
    const profile = await FanProfile.findOne({ tenantId: req.ctx.tenantId, userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }
    await recomputeDerivedTraits(req.ctx.tenantId, profile._id);
    await recalculateFanScore(req.ctx.tenantId, profile._id);
    const breakdown = await getScoreBreakdown(req.ctx.tenantId, profile._id);
    res.json({ data: breakdown, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// ── Admin endpoints ────────────────────────────────────────────────────────────

router.get(
  "/members",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const { status, planCode, search, limit, offset } = req.query;
      const result = await listMemberships(req.ctx.tenantId, {
        status,
        planCode,
        search,
        limit: Number(limit ?? 50),
        offset: Number(offset ?? 0),
      });
      res.json({ ...result, tenantId: req.ctx.tenantId });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/members/:id",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const membership = await getMembershipById(req.ctx.tenantId, req.params.id);
      const scoreBreakdown = await getScoreBreakdown(
        req.ctx.tenantId,
        membership.fanProfileId._id ?? membership.fanProfileId,
      );
      res.json({ data: { membership, scoreBreakdown }, tenantId: req.ctx.tenantId });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/priority-ranking",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 100);
      const ranking = await getPriorityRanking(req.ctx.tenantId, req.query.matchEventId, limit);
      res.json({ data: ranking, total: ranking.length, tenantId: req.ctx.tenantId });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
