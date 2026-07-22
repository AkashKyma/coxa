import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { routeMessage } from "../../services/messageRouter.js";
import { FanChannelPreference } from "../../models/FanChannelPreference.js";
import { MessageIntent } from "../../models/MessageIntent.js";

const router = Router();

/**
 * POST /api/v1/channels/router/send
 * Trigger message routing for a single fan.
 * Body: { fanId, intent, category, payload, preferredChannel }
 */
router.post("/send", requireAuth, async (req, res, next) => {
  try {
    const { fanId, intent, category, payload, preferredChannel } = req.body;

    if (!fanId || !intent || !category) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fanId, intent, and category are required",
      });
    }

    const VALID_CATEGORIES = ["transactional", "marketing", "matchday_critical", "system"];
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    const result = await routeMessage({
      tenantId: req.ctx.tenantId,
      fanId,
      intent,
      category,
      payload: payload ?? {},
      preferredChannel,
    });

    res.status(result.routed ? 200 : 202).json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/channels/router/preferences/:fanId
 * Fetch a fan's channel preferences.
 */
router.get("/preferences/:fanId", requireAuth, async (req, res, next) => {
  try {
    const prefs = await FanChannelPreference.findOne({
      tenantId: req.ctx.tenantId,
      fanId: req.params.fanId,
    }).lean();

    if (!prefs) {
      // Return defaults when no explicit preferences exist
      return res.json({
        data: {
          fanId: req.params.fanId,
          preferences: {
            email:    { enabled: true, categories: [] },
            sms:      { enabled: true, categories: [] },
            push:     { enabled: true, categories: [] },
            whatsapp: { enabled: true, categories: [] },
            in_app:   { enabled: true, categories: [] },
          },
          globalFrequency: "all",
        },
      });
    }

    res.json({ data: prefs });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/channels/router/preferences/:fanId
 * Update a fan's channel preferences.
 * Body: { preferences: { email: { enabled, categories }, sms: {...}, ... }, globalFrequency }
 */
router.put("/preferences/:fanId", requireAuth, async (req, res, next) => {
  try {
    const { preferences, globalFrequency } = req.body;

    const update = { updatedAt: new Date() };
    if (preferences) update.preferences = preferences;
    if (globalFrequency) update.globalFrequency = globalFrequency;

    const prefs = await FanChannelPreference.findOneAndUpdate(
      { tenantId: req.ctx.tenantId, fanId: req.params.fanId },
      { $set: update },
      { new: true, upsert: true, runValidators: true },
    );

    res.json({ data: prefs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/channels/router/intents
 * List the last 100 MessageIntents for this tenant, sorted by createdAt desc.
 */
router.get("/intents", requireAuth, async (req, res, next) => {
  try {
    const { status, fanId } = req.query;
    const filter = { tenantId: req.ctx.tenantId };
    if (status) filter.status = status;
    if (fanId) filter.fanId = fanId;

    const intents = await MessageIntent.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ data: intents, total: intents.length });
  } catch (err) {
    next(err);
  }
});

export default router;
