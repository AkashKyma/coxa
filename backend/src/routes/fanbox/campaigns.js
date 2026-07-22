import { Router } from "express";
import { requireFanboxAuth } from "../../middleware/requireFanboxAuth.js";
import {
  createCampaign,
  createTemplate,
  deleteCampaign,
  deleteTemplate,
  getCampaign,
  listCampaigns,
  listTemplates,
  scheduleCampaign,
  sendCampaign,
  updateCampaign,
  updateTemplate,
} from "../../services/fanboxCampaignService.js";
import {
  generateCampaignBrief,
  approveCampaign,
  rejectCampaign,
  listPendingApprovals,
  getCampaignAbSummary,
} from "../../services/aiCampaignService.js";

const router = Router();
router.use(requireFanboxAuth);

router.get("/", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await listCampaigns(tenantId, req.query);
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

router.get("/templates", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await listTemplates(tenantId, req.query);
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

router.post("/templates", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await createTemplate(tenantId, {
      ...req.body,
      createdBy: req.user?._id?.toString(),
    });
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

router.patch("/templates/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await updateTemplate(tenantId, req.params.id, req.body ?? {});
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.delete("/templates/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await deleteTemplate(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get("/:id([a-fA-F0-9]{24})", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await getCampaign(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await createCampaign(tenantId, {
      ...req.body,
      createdBy: req.user?._id?.toString(),
    });
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id([a-fA-F0-9]{24})", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await updateCampaign(tenantId, req.params.id, req.body ?? {});
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id([a-fA-F0-9]{24})", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await deleteCampaign(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/:id([a-fA-F0-9]{24})/schedule", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await scheduleCampaign(tenantId, req.params.id, {
      scheduledAt: req.body?.scheduledAt,
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/:id([a-fA-F0-9]{24})/send", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await sendCampaign(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/* ── AI Campaign routes — Phase 4 ────────────────── */

router.post("/ai/generate", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    const result = await generateCampaignBrief(tenantId, {
      objective: req.body.objective,
      channel: req.body.channel,
      staffId: req.ctx.userId,
    });
    res.status(201).json({
      data: result,
      ai_unavailable: result.brief === null,
      message: result.brief === null
        ? "Campaign saved to approval queue. Set OPENAI_API_KEY in the backend environment to enable AI brief generation."
        : "AI brief generated and saved to approval queue.",
    });
  } catch (err) { next(err); }
});

router.get("/ai/pending", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    const data = await listPendingApprovals(tenantId);
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

router.post("/ai/ab-summary", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    const data = await getCampaignAbSummary(tenantId);
    res.json({ data });
  } catch (err) { next(err); }
});

router.post("/:id([a-fA-F0-9]{24})/approve", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    const data = await approveCampaign(tenantId, req.params.id, {
      approvedBy: req.ctx.userId,
      scheduledAt: req.body.scheduledAt,
    });
    res.json({ data });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: "NOT_FOUND", message: err.message });
    next(err);
  }
});

router.post("/:id([a-fA-F0-9]{24})/reject", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    const data = await rejectCampaign(tenantId, req.params.id, {
      rejectedBy: req.ctx.userId,
      reason: req.body.reason,
    });
    res.json({ data });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: "NOT_FOUND", message: err.message });
    next(err);
  }
});

export default router;
