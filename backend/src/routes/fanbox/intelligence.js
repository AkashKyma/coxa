import { Router } from "express";
import { requireFanboxAuth } from "../../middleware/requireFanboxAuth.js";
import {
  createSavedFilter,
  deleteSavedFilter,
  exportFilterCsv,
  listSavedFilters,
  previewFilter,
  promoteFilterToSegment,
  updateSavedFilter,
} from "../../services/fanboxFilterService.js";

const router = Router();
router.use(requireFanboxAuth);

router.get("/filters", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }

    const data = await listSavedFilters(tenantId, { limit: req.query.limit });
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

router.post("/filters", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    if (!req.body?.name) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "name is required" });
    }

    const data = await createSavedFilter(tenantId, {
      name: req.body.name,
      rules: req.body.rules,
      createdBy: req.user?._id?.toString(),
    });
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

router.patch("/filters/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await updateSavedFilter(tenantId, req.params.id, req.body ?? {});
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.delete("/filters/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await deleteSavedFilter(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/filters/preview", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await previewFilter(tenantId, req.body?.rules ?? []);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/filters/:id/export", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }

    const csv = await exportFilterCsv(tenantId, req.params.id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fanbox-filter-${req.params.id}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post("/filters/:id/promote", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }

    const data = await promoteFilterToSegment(tenantId, req.params.id);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
