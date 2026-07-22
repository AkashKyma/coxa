import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireModule } from "../../middleware/requireModule.js";
import { getNextBestOffer } from "../../services/personalizationService.js";
import { getTopNOffers, getNextBestOfferV2, recordOfferConversion, getAbTestResults } from "../../services/personalizationServiceV2.js";
import { findFanProfile } from "../../services/fanProfileService.js";
import { Offer } from "../../models/Offer.js";
import { Segment } from "../../models/Segment.js";
import sanitizeHtml from "sanitize-html";

const router = Router();

// Strip all HTML tags — plain text only for offer title/description
function sanitizeText(str) {
  if (!str) return str;
  return sanitizeHtml(String(str), { allowedTags: [], allowedAttributes: {} }).trim();
}

router.use(requireModule("personalization"));

router.get("/status", async (req, res) => {
  res.json({ module: "personalization", enabled: true, tenantId: req.ctx.tenantId });
});

router.get("/offers/:id", requireAuth, async (req, res, next) => {
  try {
    const offer = await Offer.findOne({ _id: req.params.id, tenantId: req.ctx.tenantId });
    if (!offer) return res.status(404).json({ code: "NOT_FOUND", message: "Offer not found" });
    res.json({ data: offer });
  } catch (err) {
    next(err);
  }
});

router.get("/offers", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { tenantId: req.ctx.tenantId };
    if (status) filter.status = status;
    const offers = await Offer.find(filter)
      .sort({ priority: 1, createdAt: 1 })
      .populate("segmentId", "name");
    res.json({ data: offers, total: offers.length });
  } catch (err) {
    next(err);
  }
});

router.post("/offers", requireAuth, async (req, res, next) => {
  try {
    const { title, description, offerType, value, productHint, segmentId, minPoints, priority, status, validFrom, validUntil } = req.body;

    // Resolve segment name for denormalised field
    let segmentName = null;
    if (segmentId) {
      const seg = await Segment.findOne({ _id: segmentId, tenantId: req.ctx.tenantId });
      if (!seg) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Segment not found" });
      segmentName = seg.name;
    }

    const offer = await Offer.create({
      tenantId: req.ctx.tenantId,
      title: sanitizeText(title),
      description: sanitizeText(description),
      offerType,
      value: value ?? 0,
      productHint,
      segmentId: segmentId ?? null,
      segmentName,
      minPoints: minPoints ?? 0,
      priority: priority ?? 100,
      status: status ?? "active",
      validFrom: validFrom ?? null,
      validUntil: validUntil ?? null,
    });

    res.status(201).json({ data: offer });
  } catch (err) {
    next(err);
  }
});

router.put("/offers/:id", requireAuth, async (req, res, next) => {
  try {
    const { title, description, offerType, value, productHint, segmentId, minPoints, priority, status, validFrom, validUntil } = req.body;

    let segmentName = undefined;
    if (segmentId !== undefined) {
      if (segmentId) {
        const seg = await Segment.findOne({ _id: segmentId, tenantId: req.ctx.tenantId });
        if (!seg) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Segment not found" });
        segmentName = seg.name;
      } else {
        segmentName = null;
      }
    }

    const update = {};
    if (title !== undefined) update.title = sanitizeText(title);
    if (description !== undefined) update.description = sanitizeText(description);
    if (offerType !== undefined) update.offerType = offerType;
    if (value !== undefined) update.value = value;
    if (productHint !== undefined) update.productHint = productHint;
    if (segmentId !== undefined) { update.segmentId = segmentId ?? null; update.segmentName = segmentName; }
    if (minPoints !== undefined) update.minPoints = minPoints;
    if (priority !== undefined) update.priority = priority;
    if (status !== undefined) update.status = status;
    if (validFrom !== undefined) update.validFrom = validFrom ?? null;
    if (validUntil !== undefined) update.validUntil = validUntil ?? null;

    const offer = await Offer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.ctx.tenantId },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!offer) return res.status(404).json({ code: "NOT_FOUND", message: "Offer not found" });
    res.json({ data: offer });
  } catch (err) {
    next(err);
  }
});

router.delete("/offers/:id", requireAuth, async (req, res, next) => {
  try {
    const offer = await Offer.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.ctx.tenantId },
      { $set: { status: "archived" } },
      { new: true },
    );
    if (!offer) return res.status(404).json({ code: "NOT_FOUND", message: "Offer not found" });
    res.json({ data: offer });
  } catch (err) {
    next(err);
  }
});

/* ── NBO Simulator ───────────────────────────────── */

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

router.get("/next-best-offer", async (req, res, next) => {
  try {
    let fanProfileId = req.query.fanProfileId;
    const email = req.query.email;

    // Resolve by email (either via ?email= or a ?fanProfileId= that contains @)
    const emailQuery = email || (fanProfileId?.includes("@") ? fanProfileId : null);
    if (emailQuery) {
      const fan = await findFanProfile(req.ctx.tenantId, { email: emailQuery });
      if (!fan) {
        return res.status(404).json({
          code: "FAN_NOT_FOUND",
          message: "No fan profile found for that email.",
        });
      }
      fanProfileId = fan._id.toString();
    }

    if (!fanProfileId) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fanProfileId or email is required",
      });
    }

    if (!OBJECT_ID_RE.test(fanProfileId)) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Invalid fanProfileId — must be a 24-character hex ID or a fan email address.",
      });
    }

    const result = await getNextBestOffer(req.ctx.tenantId, fanProfileId);
    res.json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

/* ── v2: top-N offers + A/B ─────────────────────── */

router.get("/next-best-offers", async (req, res, next) => {
  try {
    let fanProfileId = req.query.fanProfileId;
    const emailQ = req.query.email || (fanProfileId?.includes("@") ? fanProfileId : null);
    if (emailQ) {
      const fan = await findFanProfile(req.ctx.tenantId, { email: emailQ });
      if (!fan) return res.status(404).json({ code: "FAN_NOT_FOUND", message: "No fan profile found" });
      fanProfileId = fan._id.toString();
    }
    if (!fanProfileId) return res.status(400).json({ code: "VALIDATION_ERROR", message: "fanProfileId required" });
    const result = await getTopNOffers(req.ctx.tenantId, fanProfileId, {
      channel: req.query.channel ?? "fan_app",
      record: req.query.record !== "false",
    });
    res.json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) { next(err); }
});

router.post("/offers/:id/convert", requireAuth, async (req, res, next) => {
  try {
    const { fanProfileId, revenueCents } = req.body;
    if (!fanProfileId) return res.status(400).json({ code: "VALIDATION_ERROR", message: "fanProfileId required" });
    const impression = await recordOfferConversion(req.ctx.tenantId, fanProfileId, req.params.id, { revenueCents });
    res.json({ data: impression, tenantId: req.ctx.tenantId });
  } catch (err) { next(err); }
});

router.get("/offers/:id/ab-results", requireAuth, async (req, res, next) => {
  try {
    const results = await getAbTestResults(req.ctx.tenantId, req.params.id);
    res.json({ data: results, tenantId: req.ctx.tenantId });
  } catch (err) { next(err); }
});

export default router;

