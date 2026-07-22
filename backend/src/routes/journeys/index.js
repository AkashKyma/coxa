import { Router } from "express";
import { Journey } from "../../models/Journey.js";

const router = Router();

/* ── GET /api/v1/journeys ─────────────────────────────────────────────────── */
router.get("/", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? req.clubId ?? req.user?.tenantId ?? "default";
    const journeys = await Journey.find(
      { tenantId, status: { $ne: "archived" } },
      { nodes: 0, edges: 0 }
    ).sort({ createdAt: -1 });
    res.json({ journeys });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/journeys ────────────────────────────────────────────────── */
router.post("/", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? req.clubId ?? req.user?.tenantId ?? "default";
    const { name, description, trigger, nodes, edges } = req.body;
    const journey = await Journey.create({
      tenantId,
      name: name ?? "Nova Jornada",
      description,
      trigger: trigger ?? { type: "manual" },
      nodes: nodes ?? [],
      edges: edges ?? [],
      createdBy: req.user?._id,
    });
    res.status(201).json({ journey });
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/v1/journeys/:id ─────────────────────────────────────────────── */
router.get("/:id", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? req.clubId ?? req.user?.tenantId ?? "default";
    const journey = await Journey.findOne({ _id: req.params.id, tenantId });
    if (!journey) return res.status(404).json({ code: "NOT_FOUND", message: "Journey not found" });
    res.json({ journey });
  } catch (err) {
    next(err);
  }
});

/* ── PUT /api/v1/journeys/:id ─────────────────────────────────────────────── */
router.put("/:id", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? req.clubId ?? req.user?.tenantId ?? "default";
    const allowed = ["name", "description", "trigger", "nodes", "edges"];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const journey = await Journey.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!journey) return res.status(404).json({ code: "NOT_FOUND", message: "Journey not found" });
    res.json({ journey });
  } catch (err) {
    next(err);
  }
});

/* ── PATCH /api/v1/journeys/:id/status ───────────────────────────────────── */
router.patch("/:id/status", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? req.clubId ?? req.user?.tenantId ?? "default";
    const { status } = req.body;
    const allowed = ["active", "paused", "archived"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ code: "INVALID_STATUS", message: `status must be one of: ${allowed.join(", ")}` });
    }
    const update = { status };
    if (status === "active") update.publishedAt = new Date();
    const journey = await Journey.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!journey) return res.status(404).json({ code: "NOT_FOUND", message: "Journey not found" });
    res.json({ journey });
  } catch (err) {
    next(err);
  }
});

/* ── DELETE /api/v1/journeys/:id ─────────────────────────────────────────── */
router.delete("/:id", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? req.clubId ?? req.user?.tenantId ?? "default";
    const journey = await Journey.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: { status: "archived" } },
      { new: true }
    );
    if (!journey) return res.status(404).json({ code: "NOT_FOUND", message: "Journey not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
