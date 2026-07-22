import { Router } from "express";
import {
  listMembershipPlans,
  createMembershipPlan,
  memberCheckIn,
  createCheckInWindow,
  listCheckInWindows,
} from "../../services/membershipCheckInService.js";
import { getAvailableWindowsForFan, openWindowsForMatch } from "../../services/priorityEngineService.js";
import { FanProfile } from "../../models/FanProfile.js";

const router = Router();

router.get("/plans", async (req, res, next) => {
  try {
    const plans = await listMembershipPlans(req.ctx.tenantId);
    res.json({ data: plans, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/plans", async (req, res, next) => {
  try {
    const plan = await createMembershipPlan(req.ctx.tenantId, req.body);
    res.status(201).json({ data: plan, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// GET /windows/:matchEventId — list all windows for a match
router.get("/windows/:matchEventId", async (req, res, next) => {
  try {
    const windows = await listCheckInWindows(req.ctx.tenantId, req.params.matchEventId);
    res.json({ data: windows, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// POST /windows — create a check-in window (now accepts fanScoreMin)
router.post("/windows", async (req, res, next) => {
  try {
    const win = await createCheckInWindow(req.ctx.tenantId, req.body);
    res.status(201).json({ data: win, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// GET /windows/:matchEventId/eligible — which windows can this fan access?
router.get("/windows/:matchEventId/eligible", async (req, res, next) => {
  try {
    const { fanProfileId, fanEmail } = req.query;

    let profile = null;
    if (fanProfileId) {
      profile = await FanProfile.findOne({ _id: fanProfileId, tenantId: req.ctx.tenantId });
    } else if (fanEmail) {
      profile = await FanProfile.findOne({
        email: fanEmail.toLowerCase(),
        tenantId: req.ctx.tenantId,
      });
    }

    if (!profile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }

    const windows = await getAvailableWindowsForFan(
      req.ctx.tenantId,
      profile._id,
      req.params.matchEventId,
    );
    res.json({ data: windows, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

// POST /windows/:matchEventId/sync — admin: open/close windows by time
router.post("/windows/:matchEventId/sync", async (req, res, next) => {
  try {
    const results = await openWindowsForMatch(req.ctx.tenantId, req.params.matchEventId);
    res.json({ data: results, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const idempotencyKey =
      req.body.idempotencyKey ?? req.headers["idempotency-key"] ?? `checkin-${Date.now()}`;
    const result = await memberCheckIn({
      tenantId: req.ctx.tenantId,
      matchEventId: req.body.matchEventId,
      fanEmail: req.body.fanEmail,
      fanProfileId: req.body.fanProfileId,
      memberId: req.body.memberId,
      checkInWindowId: req.body.checkInWindowId,
      idempotencyKey,
    });
    res.status(result.duplicate ? 200 : 201).json({
      data: result,
      duplicate: result.duplicate,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
