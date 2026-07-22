import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { Label, EntityLabel } from "../models/Label.js";

const router = Router();
router.use(requireAuth);

function tid(req) { return req.ctx?.tenantId; }

function slugify(name) {
  return String(name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── Label CRUD ────────────────────────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { entityType } = req.query;
    const q = { tenantId: tid(req) };
    if (entityType) q.applicableTo = entityType;
    const labels = await Label.find(q).sort({ name: 1 }).lean();
    res.json({ data: labels, total: labels.length });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, color, description, applicableTo } = req.body;
    if (!name?.trim()) return res.status(400).json({ code: "NAME_REQUIRED", message: "name is required" });
    const label = await Label.create({
      tenantId: tid(req),
      name: name.trim(),
      slug: slugify(name),
      color,
      description,
      applicableTo: applicableTo ?? ["fan"],
      createdBy: req.user?._id ?? req.fanboxStaff?.userId,
    });
    res.status(201).json({ data: label });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { name, color, description, applicableTo } = req.body;
    const updates = {};
    if (name !== undefined) { updates.name = name.trim(); updates.slug = slugify(name); }
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description;
    if (applicableTo !== undefined) updates.applicableTo = applicableTo;
    const label = await Label.findOneAndUpdate({ _id: req.params.id, tenantId: tid(req) }, { $set: updates }, { new: true });
    if (!label) return res.status(404).json({ code: "NOT_FOUND" });
    res.json({ data: label });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await Label.findOneAndDelete({ _id: req.params.id, tenantId: tid(req) });
    await EntityLabel.deleteMany({ tenantId: tid(req), labelId: req.params.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Entity Label tagging ──────────────────────────────────────────────────────

/** GET /labels/entity/:entityType/:entityId — get all labels on an entity */
router.get("/entity/:entityType/:entityId", async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const tags = await EntityLabel.find({ tenantId: tid(req), entityType, entityId }).populate("labelId").lean();
    res.json({ data: tags.map((t) => t.labelId).filter(Boolean) });
  } catch (err) { next(err); }
});

/** POST /labels/entity/:entityType/:entityId — apply labels */
router.post("/entity/:entityType/:entityId", async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { labelIds = [] } = req.body;
    const docs = labelIds.map((labelId) => ({
      tenantId: tid(req), labelId, entityType, entityId,
      appliedBy: req.user?._id ?? req.fanboxStaff?.userId,
    }));
    await EntityLabel.insertMany(docs, { ordered: false }).catch(() => {}); // ignore dup key
    res.json({ ok: true, count: docs.length });
  } catch (err) { next(err); }
});

/** DELETE /labels/entity/:entityType/:entityId/:labelId — remove a label */
router.delete("/entity/:entityType/:entityId/:labelId", async (req, res, next) => {
  try {
    const { entityType, entityId, labelId } = req.params;
    await EntityLabel.deleteOne({ tenantId: tid(req), entityType, entityId, labelId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** POST /labels/bulk-apply — apply labels to multiple entities */
router.post("/bulk-apply", async (req, res, next) => {
  try {
    const { entityType, entityIds = [], labelIds = [] } = req.body;
    if (!entityType || !entityIds.length || !labelIds.length) {
      return res.status(400).json({ code: "INVALID_INPUT", message: "entityType, entityIds, and labelIds are required." });
    }
    const docs = entityIds.flatMap((entityId) =>
      labelIds.map((labelId) => ({
        tenantId: tid(req), labelId, entityType, entityId,
        appliedBy: req.user?._id ?? req.fanboxStaff?.userId,
      })),
    );
    const result = await EntityLabel.insertMany(docs, { ordered: false }).catch((e) => e.result ?? { nInserted: 0 });
    res.json({ ok: true, applied: result.insertedCount ?? docs.length });
  } catch (err) { next(err); }
});

export default router;
