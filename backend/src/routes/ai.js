import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateKpiInsights, chatWithContext, discoverAdditionalKpis } from "../services/aiInsightsService.js";
import { ragChat, retrieveChunks } from "../services/ai/ragService.js";
import { seedAllKnowledge } from "../services/ai/seedKnowledgeBase.js";

const router = Router();
router.use(requireAuth);

function tid(req) { return req.ctx?.tenantId ?? null; }
function userRole(req) { return req.user?.role ?? req.fanboxStaff?.role ?? "executive_viewer"; }
function tenantName(req) { return req.ctx?.clubName ?? "Club"; }

/**
 * POST /api/v1/ai/assistant   ← primary RAG chat endpoint (WS8)
 * Body: { messages: [{role, content}], kpiContext? }
 * Returns: { data: { content, sources?, usage? } }
 *
 * This is the main endpoint consumed by AiChatWidget in both dashboards.
 * It uses the full RAG pipeline: embed query → retrieve top-K chunks → generate.
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
 * POST /api/v1/ai/insights
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
 * POST /api/v1/ai/chat   (legacy alias for /assistant without RAG)
 * Body: { messages: [{role, content}], kpiContext? }
 */
router.post("/chat", async (req, res, next) => {
  try {
    const { messages = [], kpiContext } = req.body;
    const result = await chatWithContext(messages, {
      role: userRole(req),
      tenantName: tenantName(req),
      kpiContext,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/ai/discover-kpis
 * Body: { department, industry?, existingKeys? }
 */
router.post("/discover-kpis", async (req, res, next) => {
  try {
    const { department, industry, existingKeys } = req.body;
    const result = await discoverAdditionalKpis({ department, industry, existingKeys });
    res.json({ data: result });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/ai/knowledge-status
 * Returns count of indexed RAG chunks.
 */
router.get("/knowledge-status", async (req, res, next) => {
  try {
    const { RagChunk } = await import("../services/ai/ragService.js");
    const count = await RagChunk.countDocuments();
    res.json({ data: { chunks: count, ready: count > 0 } });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/ai/seed-knowledge   (admin only)
 * Triggers re-ingestion of all platform docs + KPI registry into the vector store.
 */
router.post("/seed-knowledge", async (req, res, next) => {
  const role = userRole(req);
  if (!["administrator", "admin", "super_admin", "club_admin"].includes(role?.toLowerCase())) {
    return res.status(403).json({ error: "Admin role required to seed knowledge base." });
  }
  try {
    // Run in background; respond immediately
    res.json({ data: { message: "Knowledge base seeding started.", status: "running" } });
    seedAllKnowledge({ verbose: true }).catch((e) => console.error("[RAG seed error]", e));
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/ai/search?q=...   (debug)
 * Returns top RAG chunks for a query.
 */
router.get("/search", async (req, res, next) => {
  try {
    const q = req.query.q ?? "";
    const chunks = await retrieveChunks(q, { tenantId: tid(req), k: 5 });
    res.json({ data: chunks.map((c) => ({ source: c.source, score: c.score, preview: c.text.slice(0, 200) })) });
  } catch (err) { next(err); }
});

export default router;
