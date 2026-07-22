import { Router } from "express";
import { requireModule } from "../../middleware/requireModule.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { publishEvent, listEvents, replayDlqEvent } from "../../services/cdp/cdpEventService.js";
import { runSegmentQuery, countSegmentQuery } from "../../services/segmentQueryService.js";
import {
  listSegments,
  createSegment,
  updateSegment,
  previewSegment,
} from "../../services/segmentService.js";
import { searchFanProfiles } from "../../services/fanProfileService.js";
import { lookupCustomer360, buildCustomer360 } from "../../services/customer360Service.js";
import { Segment } from "../../models/Segment.js";
import {
  getFanMlScores,
  getBatchMlScores,
  getChurnRiskSummary,
  getChannelDistribution,
} from "../../services/mlScoringService.js";
import tracardiWebhookBridge from "./tracardiWebhookBridge.js";
import {
  listTracardiSegments,
  getTracardiSegment,
  getTracardiSegmentProfiles,
  pingTracardi,
} from "../../services/tracardiService.js";

const router = Router();

router.use(requireModule("cdp"));

router.get("/status", async (req, res) => {
  res.json({ module: "cdp", enabled: true, tenantId: req.ctx.tenantId });
});

/* ── Events ─────────────────────────────────────── */
router.get("/events", requireAuth, async (req, res, next) => {
  try {
    const events = await listEvents(req.ctx.tenantId, {
      eventName: req.query.eventName,
      fanProfileId: req.query.fanProfileId,
      status: req.query.status,
      limit: Number(req.query.limit ?? 100),
    });
    res.json({ data: events, total: events.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/events", async (req, res, next) => {
  try {
    const result = await publishEvent({
      tenantId: req.ctx.tenantId,
      ...req.body,
    });
    res.status(result.duplicate ? 200 : 201).json({
      data: result.event,
      duplicate: result.duplicate,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.post("/events/:id/replay", requireAuth, async (req, res, next) => {
  try {
    const event = await replayDlqEvent(req.ctx.tenantId, req.params.id);
    res.json({ data: event, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

/* ── Profiles ───────────────────────────────────── */
router.get("/profiles/search", requireAuth, async (req, res, next) => {
  try {
    const q = req.query.q ?? "";
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const profiles = await searchFanProfiles(req.ctx.tenantId, q, limit);
    res.json({ data: profiles, total: profiles.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

/* ── Profile Edit ───────────────────────────────── */
router.patch("/profiles/:profileId/edit", requireAuth, async (req, res, next) => {
  try {
    const { FanProfile } = await import("../../models/FanProfile.js");
    const allowed = [
      "fullName", "email", "phone", "dateOfBirth", "gender",
      "address", "favoritePlayer", "jerseySize", "preferredLanguage",
      "tags", "notes",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.notes && String(update.notes).length > 1000) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "notes max 1000 chars" });
    }
    const profile = await FanProfile.findOneAndUpdate(
      { _id: req.params.profileId, tenantId: req.ctx.tenantId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!profile) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Fan profile not found" });
    }
    res.json({ data: profile, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: err.code, message: err.message });
    next(err);
  }
});

/* ── Customer 360 ───────────────────────────────── */
router.get("/customer-360", requireAuth, async (req, res, next) => {
  try {
    const q = req.query.q ?? req.query.fanProfileId;
    if (!q) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "q or fanProfileId required" });
    }
    const data = await lookupCustomer360(req.ctx.tenantId, q, {
      revealPii: req.query.revealPii === "true",
    });
    res.json({ data, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.get("/customer-360/:fanProfileId", requireAuth, async (req, res, next) => {
  try {
    const data = await buildCustomer360(req.ctx.tenantId, req.params.fanProfileId, {
      revealPii: req.query.revealPii === "true",
    });
    res.json({ data, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

/* ── Visual Segment Builder (query-builder → MongoDB) ─────────────────── */

/**
 * POST /api/v1/cdp/segments/query
 * Body: { query: RuleGroup, limit?, skip? }
 * Returns: { data: Fan[], count, tenantId }
 */
router.post("/segments/query", requireAuth, async (req, res, next) => {
  try {
    const { query, limit = 200, skip = 0 } = req.body;
    if (!query || !Array.isArray(query.rules)) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "query.rules array required" });
    }
    const result = await runSegmentQuery(req.ctx.tenantId, query, {
      limit: Math.min(Number(limit), 500),
      skip: Number(skip),
    });
    res.json({ data: result.fans, count: result.count, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/cdp/segments/query/count
 * Body: { query: RuleGroup }
 * Returns: { count, tenantId }  — lightweight preview count
 */
router.post("/segments/query/count", requireAuth, async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || !Array.isArray(query.rules)) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "query.rules array required" });
    }
    const { count } = await countSegmentQuery(req.ctx.tenantId, query);
    res.json({ count, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

/* ── Segments ───────────────────────────────────── */
router.get("/segments", requireAuth, async (req, res, next) => {
  try {
    const segments = await listSegments(req.ctx.tenantId);
    res.json({ data: segments, total: segments.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/segments", requireAuth, async (req, res, next) => {
  try {
    const segment = await createSegment(req.ctx.tenantId, {
      ...req.body,
      createdBy: req.ctx.userId,
    });
    res.status(201).json({ data: segment, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ code: "DUPLICATE_SEGMENT", message: "Segment name already exists" });
    }
    next(err);
  }
});

router.patch("/segments/:id", requireAuth, async (req, res, next) => {
  try {
    const segment = await updateSegment(req.ctx.tenantId, req.params.id, req.body);
    res.json({ data: segment, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.put("/segments/:id", requireAuth, async (req, res, next) => {
  try {
    const segment = await updateSegment(req.ctx.tenantId, req.params.id, req.body);
    res.json({ data: segment, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.delete("/segments/:id", requireAuth, async (req, res, next) => {
  try {
    const segment = await Segment.findOneAndDelete({ _id: req.params.id, tenantId: req.ctx.tenantId });
    if (!segment) {
      return res.status(404).json({ code: "SEGMENT_NOT_FOUND", message: "Segment not found" });
    }
    res.json({ data: { deleted: true }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/segments/estimate", requireAuth, async (req, res, next) => {
  try {
    const { conditions, logic, rules } = req.body;
    const allConditions = conditions ?? rules ?? [];
    const result = await previewSegment(req.ctx.tenantId, allConditions.map((c) => ({
      traitKey: c.traitKey ?? c.trait,
      operator: c.operator,
      value: c.value,
    })));
    res.json({ estimatedSize: result.memberCount ?? 0, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/segments/preview", requireAuth, async (req, res, next) => {
  try {
    const preview = await previewSegment(req.ctx.tenantId, req.body.rules ?? []);
    res.json({ data: preview, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/segments/:id", requireAuth, async (req, res, next) => {
  try {
    const segment = await Segment.findOne({ _id: req.params.id, tenantId: req.ctx.tenantId });
    if (!segment) {
      return res.status(404).json({ code: "SEGMENT_NOT_FOUND", message: "Segment not found" });
    }
    res.json({ data: segment, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

/* ── ML Scores ──────────────────────────────────── */
router.get("/ml/summary", requireAuth, async (req, res, next) => {
  try {
    const [summary, channels] = await Promise.all([
      getChurnRiskSummary(req.ctx.tenantId),
      getChannelDistribution(req.ctx.tenantId),
    ]);
    res.json({ data: { ...summary, channelDistribution: channels }, tenantId: req.ctx.tenantId });
  } catch (err) { next(err); }
});

router.get("/ml/scores", requireAuth, async (req, res, next) => {
  try {
    const scores = await getBatchMlScores(req.ctx.tenantId, {
      limit: Number(req.query.limit ?? 200),
      offset: Number(req.query.offset ?? 0),
    });
    res.json({ data: scores, total: scores.length, tenantId: req.ctx.tenantId });
  } catch (err) { next(err); }
});

router.get("/ml/scores/:fanProfileId", requireAuth, async (req, res, next) => {
  try {
    const scores = await getFanMlScores(req.ctx.tenantId, req.params.fanProfileId);
    if (!scores) return res.status(404).json({ code: "NOT_FOUND", message: "Fan not found" });
    res.json({ data: scores, tenantId: req.ctx.tenantId });
  } catch (err) { next(err); }
});

/* ── Tracardi Segments (Visual Builder) ─────────── */
router.get("/tracardi/health", requireAuth, async (req, res) => {
  const ok = await pingTracardi();
  res.json({ reachable: ok });
});

router.get("/tracardi/segments", requireAuth, async (req, res, next) => {
  try {
    const segments = await listTracardiSegments();
    res.json({ data: segments, total: segments.length });
  } catch (err) { next(err); }
});

router.get("/tracardi/segments/:id", requireAuth, async (req, res, next) => {
  try {
    const segment = await getTracardiSegment(req.params.id);
    if (!segment) return res.status(404).json({ code: "NOT_FOUND", message: "Segment not found in Tracardi" });
    res.json({ data: segment });
  } catch (err) { next(err); }
});

router.get("/tracardi/segments/:id/profiles", requireAuth, async (req, res, next) => {
  try {
    const profiles = await getTracardiSegmentProfiles(req.params.id, {
      limit: Number(req.query.limit ?? 100),
    });
    res.json({ data: profiles, total: profiles.length });
  } catch (err) { next(err); }
});

/* ── Tracardi Webhook Bridge ─────────────────────── */
router.use("/tracardi-bridge", tracardiWebhookBridge);

/* ── ClickHouse Health Proxy ────────────────────── */
router.get("/clickhouse/health", requireAuth, async (_req, res) => {
  try {
    const host = process.env.CLICKHOUSE_HOST || "localhost";
    const port = process.env.CLICKHOUSE_HTTP_PORT || 8123;
    const url = `http://${host}:${port}/ping`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const text = await response.text();
    if (text.trim() === "Ok.") {
      return res.json({ status: "ok", latencyMs: 0 });
    }
    return res.status(503).json({ status: "error", detail: text.trim() });
  } catch (err) {
    return res.status(503).json({ status: "error", detail: err.message });
  }
});

/* ── Cube Health Proxy ──────────────────────────── */
router.get("/cube/health", requireAuth, async (_req, res) => {
  try {
    const cubeUrl = process.env.CUBE_API_URL || "http://localhost:4000/cubejs-api/v1";
    const base = cubeUrl.replace(/\/cubejs-api.*$/, "");
    const response = await fetch(`${base}/livez`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      return res.json({ status: "ok" });
    }
    return res.status(503).json({ status: "error", httpStatus: response.status });
  } catch (err) {
    return res.status(503).json({ status: "error", detail: err.message });
  }
});

/* ── RudderStack Webhook (receives processed events from RudderStack) ── */
router.post("/rudderstack-webhook", async (req, res, next) => {
  try {
    const secret = req.headers["x-rudderstack-secret"];
    if (secret !== process.env.RUDDERSTACK_WEBHOOK_SECRET) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid webhook secret" });
    }

    const batch = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const event of batch) {
      if (event.type !== "track") continue;

      const props = event.properties || {};
      const eventName = props.coxa_event_name;
      if (!eventName) continue;

      results.push({
        userId: event.userId,
        event: eventName,
        receivedAt: event.receivedAt || new Date().toISOString(),
      });
    }

    res.status(200).json({ received: results.length, events: results });
  } catch (err) {
    next(err);
  }
});

export default router;
