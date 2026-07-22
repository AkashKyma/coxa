import { Router } from "express";
import { requireFanboxAuth } from "../../middleware/requireFanboxAuth.js";
import {
  getImportJobById,
  importFanboxCsv,
  listImportJobs,
} from "../../services/fanboxImportService.js";

const router = Router();
router.use(requireFanboxAuth);

router.post("/:type", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const { type } = req.params;
    if (!["cadastros", "leads"].includes(type)) {
      return res.status(400).json({ code: "INVALID_IMPORT_TYPE", message: "type must be cadastros or leads" });
    }

    const job = await importFanboxCsv({
      tenantId,
      type,
      rows: req.body?.rows,
      csvText: req.body?.csvText,
      filename: req.body?.filename,
      createdBy: req.user?._id?.toString(),
    });
    res.status(201).json({ data: job });
  } catch (err) {
    next(err);
  }
});

router.get("/jobs", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await listImportJobs(tenantId, req.query);
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

router.get("/jobs/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await getImportJobById(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
