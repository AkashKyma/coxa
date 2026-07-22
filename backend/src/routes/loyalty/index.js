import { Router } from "express";
import { requireModule } from "../../middleware/requireModule.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  getBalance,
  getBalanceSummary,
  getLedger,
  listRules,
  upsertRule,
  adjustPoints,
  redeemPoints,
  listRewards,
  upsertReward,
  redeemReward,
  formatRuleForFan,
} from "../../services/loyaltyService.js";
import { findFanProfile } from "../../services/fanProfileService.js";
import tiersRouter from "./tiers.js";

const router = Router();

router.use(requireModule("loyalty"));

router.use("/tiers", tiersRouter);

router.get("/status", async (req, res) => {
  res.json({ module: "loyalty", enabled: true, tenantId: req.ctx.tenantId });
});

router.get("/rules", requireAuth, async (req, res, next) => {
  try {
    const rules = await listRules(req.ctx.tenantId);
    res.json({ data: rules, total: rules.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/rules", requireAuth, async (req, res, next) => {
  try {
    const rule = await upsertRule(req.ctx.tenantId, req.body);
    res.status(req.body.id ? 200 : 201).json({ data: rule, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.get("/rewards", async (req, res, next) => {
  try {
    const forFan = req.query.forFan === "true";
    const rewards = await listRewards(req.ctx.tenantId, {
      status: forFan ? undefined : req.query.status,
      forFan,
    });
    res.json({ data: rewards, total: rewards.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/rewards", requireAuth, async (req, res, next) => {
  try {
    const reward = await upsertReward(req.ctx.tenantId, req.body);
    res.status(req.body.id ? 200 : 201).json({ data: reward, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.get("/balance/:fanProfileId", requireAuth, async (req, res, next) => {
  try {
    const summary = await getBalanceSummary(req.ctx.tenantId, req.params.fanProfileId);
    res.json({ data: { fanProfileId: req.params.fanProfileId, ...summary }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/ledger/:fanProfileId", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const ledger = await getLedger(req.ctx.tenantId, req.params.fanProfileId, limit);
    res.json({ data: ledger, total: ledger.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const fan = await findFanProfile(req.ctx.tenantId, {
      fanProfileId: req.query.fanProfileId,
      email: req.query.email,
      userId: req.ctx.userId,
    });
    if (!fan) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }
    const [summary, ledger, earnRules, rewards] = await Promise.all([
      getBalanceSummary(req.ctx.tenantId, fan._id),
      getLedger(req.ctx.tenantId, fan._id, 30),
      listRules(req.ctx.tenantId, { activeOnly: true }),
      listRewards(req.ctx.tenantId, { forFan: true }),
    ]);

    res.json({
      data: {
        fan,
        balance: summary.balance,
        summary,
        ledger,
        earnRules: earnRules
          .filter((r) => r.ruleType.startsWith("earn_"))
          .map(formatRuleForFan),
        rewards,
      },
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/me/redeem-reward", requireAuth, async (req, res, next) => {
  try {
    const fan = await findFanProfile(req.ctx.tenantId, {
      userId: req.user?._id?.toString() ?? req.user?.id?.toString(),
    });
    if (!fan) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }
    const { rewardId, idempotencyKey } = req.body;
    if (!rewardId) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "rewardId is required" });
    }
    const result = await redeemReward({
      tenantId: req.ctx.tenantId,
      fanProfileId: fan._id,
      rewardId,
      idempotencyKey,
      createdBy: req.ctx.userId,
    });
    res.status(201).json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.post("/adjust", requireAuth, async (req, res, next) => {
  try {
    const { fanProfileId, pointsDelta, note } = req.body;
    if (!fanProfileId || pointsDelta == null) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fanProfileId and pointsDelta are required",
      });
    }
    const idempotencyKey = req.body.idempotencyKey ?? `adjust-${fanProfileId}-${Date.now()}`;
    const entry = await adjustPoints({
      tenantId: req.ctx.tenantId,
      fanProfileId,
      pointsDelta: Number(pointsDelta),
      note,
      createdBy: req.ctx.userId,
      idempotencyKey,
    });
    res.status(201).json({ data: entry, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.post("/redeem", requireAuth, async (req, res, next) => {
  try {
    const { fanProfileId, points, note, referenceType, referenceId, rewardId } = req.body;
    if (rewardId) {
      const result = await redeemReward({
        tenantId: req.ctx.tenantId,
        fanProfileId,
        rewardId,
        idempotencyKey: req.body.idempotencyKey,
        createdBy: req.ctx.userId,
      });
      return res.status(201).json({ data: result, tenantId: req.ctx.tenantId });
    }
    if (!fanProfileId || !points) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fanProfileId and points are required",
      });
    }
    const idempotencyKey = req.body.idempotencyKey ?? `redeem-${fanProfileId}-${Date.now()}`;
    const entry = await redeemPoints({
      tenantId: req.ctx.tenantId,
      fanProfileId,
      points: Number(points),
      note,
      referenceType,
      referenceId,
      idempotencyKey,
    });
    res.status(201).json({ data: entry, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

export default router;
