import { Router } from "express";
import { requireFanboxAuth } from "../../middleware/requireFanboxAuth.js";
import { generateKpiInsights, chatWithContext } from "../../services/aiInsightsService.js";
import { ragChat, retrieveChunks, RagChunk } from "../../services/ai/ragService.js";
import { seedAllKnowledge } from "../../services/ai/seedKnowledgeBase.js";

const router = Router();
router.use(requireFanboxAuth);

function tid(req) { return req.ctx?.tenantId ?? null; }
function userRole(req) { return req.fanboxStaff?.role ?? req.user?.role ?? "executive_viewer"; }
function tenantName(req) { return req.ctx?.clubName ?? "Club"; }

/**
 * POST /api/v1/fanbox/ai/assistant
 * Full RAG chat — consumed by AiChatWidget in fanbox-dashboard.
 * Body: { messages: [{role, content}], kpiContext? }
 */
router.post("/assistant", async (req, res, next) => {
  try {
    const { messages = [], kpiContext } = req.body;
    const result = await ragChat(messages, {
      tenantId: tid(req),
      role: userRole(req),
      tenantName: tenantName(req),
      kpiContext,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/fanbox/ai/insights
 * KPI narrative generation.
 * Body: { kpis: [{key, label, value, unit}], from, to }
 */
router.post("/insights", async (req, res, next) => {
  try {
    const { kpis = [], from, to } = req.body;
    const result = await generateKpiInsights(kpis, {
      role: userRole(req),
      tenantName: tenantName(req),
      from,
      to,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/fanbox/ai/knowledge-status
 * Returns count of indexed RAG chunks.
 */
router.get("/knowledge-status", async (req, res, next) => {
  try {
    const count = await RagChunk.countDocuments();
    res.json({ data: { chunks: count, ready: count > 0 } });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/fanbox/ai/search?q=...  (debug)
 */
router.get("/search", async (req, res, next) => {
  try {
    const q = req.query.q ?? "";
    const chunks = await retrieveChunks(q, { tenantId: tid(req), k: 5 });
    res.json({ data: chunks.map((c) => ({ source: c.source, score: c.score, preview: c.text.slice(0, 200) })) });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/fanbox/ai/seed-knowledge  (fanbox_admin only)
 */
router.post("/seed-knowledge", async (req, res, next) => {
  if (req.fanboxStaff?.role !== "fanbox_admin") {
    return res.status(403).json({ code: "FORBIDDEN", message: "fanbox_admin role required" });
  }
  try {
    res.json({ data: { message: "Knowledge base seeding started.", status: "running" } });
    seedAllKnowledge({ verbose: true }).catch((e) => console.error("[RAG seed error]", e));
  } catch (err) { next(err); }
});

export default router;
