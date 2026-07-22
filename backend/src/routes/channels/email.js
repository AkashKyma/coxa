import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { EmailTemplate } from "../../models/EmailTemplate.js";
import { EmailCampaign } from "../../models/EmailCampaign.js";
import { queueCampaignSend, handleSesWebhook } from "../../services/emailService.js";

const router = Router();

/* ── Template Routes ────────────────────────────────────────────────────── */

router.get("/templates", requireAuth, async (req, res, next) => {
  try {
    const { category, status } = req.query;
    const filter = { tenantId: req.ctx.tenantId };
    if (category) filter.category = category;
    if (status) filter.status = status;

    const templates = await EmailTemplate.find(filter).sort({ createdAt: -1 });
    res.json({ data: templates, total: templates.length });
  } catch (err) {
    next(err);
  }
});

router.post("/templates", requireAuth, async (req, res, next) => {
  try {
    const {
      name,
      slug,
      category,
      subjectLines,
      mjmlSource,
      compiledHtml,
      plainTextFallback,
      thumbnailUrl,
      locales,
      tokensUsed,
      status,
    } = req.body;

    const template = await EmailTemplate.create({
      tenantId: req.ctx.tenantId,
      name,
      slug,
      category,
      subjectLines: subjectLines ?? [],
      mjmlSource,
      compiledHtml,
      plainTextFallback,
      thumbnailUrl,
      locales: locales ?? ["pt-BR"],
      tokensUsed: tokensUsed ?? [],
      status: status ?? "draft",
      createdBy: req.user._id,
    });

    res.status(201).json({ data: template });
  } catch (err) {
    next(err);
  }
});

router.get("/templates/:id", requireAuth, async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      tenantId: req.ctx.tenantId,
    });
    if (!template) return res.status(404).json({ code: "NOT_FOUND", message: "Template not found" });
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

router.put("/templates/:id", requireAuth, async (req, res, next) => {
  try {
    const allowed = [
      "name",
      "slug",
      "category",
      "subjectLines",
      "mjmlSource",
      "compiledHtml",
      "plainTextFallback",
      "thumbnailUrl",
      "locales",
      "tokensUsed",
      "status",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.status === "archived") update.archivedAt = new Date();

    const template = await EmailTemplate.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.ctx.tenantId },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!template) return res.status(404).json({ code: "NOT_FOUND", message: "Template not found" });
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

/* ── Campaign Routes ────────────────────────────────────────────────────── */

router.get("/campaigns", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { tenantId: req.ctx.tenantId };
    if (status) filter.status = status;

    const campaigns = await EmailCampaign.find(filter)
      .sort({ createdAt: -1 })
      .populate("templateId", "name slug category");
    res.json({ data: campaigns, total: campaigns.length });
  } catch (err) {
    next(err);
  }
});

router.post("/campaigns", requireAuth, async (req, res, next) => {
  try {
    const {
      name,
      templateId,
      senderName,
      senderEmail,
      replyTo,
      audienceSegmentId,
      excludeSegmentIds,
      scheduledAt,
      timezone,
      abTest,
      sendTimeOptimization,
      frequencyCapOverride,
      utmParams,
    } = req.body;

    const campaign = await EmailCampaign.create({
      tenantId: req.ctx.tenantId,
      name,
      templateId,
      senderName,
      senderEmail,
      replyTo,
      audienceSegmentId: audienceSegmentId ?? null,
      excludeSegmentIds: excludeSegmentIds ?? [],
      scheduledAt: scheduledAt ?? null,
      timezone: timezone ?? "America/Sao_Paulo",
      abTest: abTest ?? {},
      sendTimeOptimization: sendTimeOptimization ?? false,
      frequencyCapOverride: frequencyCapOverride ?? false,
      utmParams: utmParams ?? {},
      createdBy: req.user._id,
    });

    res.status(201).json({ data: campaign });
  } catch (err) {
    next(err);
  }
});

router.put("/campaigns/:id", requireAuth, async (req, res, next) => {
  try {
    const allowed = [
      "name",
      "templateId",
      "senderName",
      "senderEmail",
      "replyTo",
      "audienceSegmentId",
      "excludeSegmentIds",
      "scheduledAt",
      "timezone",
      "abTest",
      "sendTimeOptimization",
      "frequencyCapOverride",
      "utmParams",
      "status",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.ctx.tenantId },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!campaign) return res.status(404).json({ code: "NOT_FOUND", message: "Campaign not found" });
    res.json({ data: campaign });
  } catch (err) {
    next(err);
  }
});

router.post("/campaigns/:id/approve", requireAuth, async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.ctx.tenantId },
      { $set: { approvalStatus: "approved", approvedBy: req.user._id } },
      { new: true },
    );
    if (!campaign) return res.status(404).json({ code: "NOT_FOUND", message: "Campaign not found" });
    res.json({ data: campaign });
  } catch (err) {
    next(err);
  }
});

router.post("/campaigns/:id/send", requireAuth, async (req, res, next) => {
  try {
    const result = await queueCampaignSend({
      campaignId: req.params.id,
      tenantId: req.ctx.tenantId,
    });
    res.json({ data: result });
  } catch (err) {
    // Surface domain validation errors as 400
    if (err.message?.includes("not approved") || err.message?.includes("not found")) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: err.message });
    }
    next(err);
  }
});

router.get("/campaigns/:id/stats", requireAuth, async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOne({
      _id: req.params.id,
      tenantId: req.ctx.tenantId,
    }).select("stats status name");
    if (!campaign) return res.status(404).json({ code: "NOT_FOUND", message: "Campaign not found" });
    res.json({ data: { stats: campaign.stats, status: campaign.status, name: campaign.name } });
  } catch (err) {
    next(err);
  }
});

/* ── SES Webhook (public — no requireAuth) ──────────────────────────────── */

router.post("/webhooks/ses", async (req, res, next) => {
  try {
    await handleSesWebhook(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
