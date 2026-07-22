import { Router } from "express";
import { requireFanboxAuth } from "../../middleware/requireFanboxAuth.js";
import {
  closeProject,
  createProject,
  drawRaffleWinner,
  getProject,
  listProjects,
  listResponses,
  submitResponse,
  updateProject,
} from "../../services/fanboxProjectService.js";

const router = Router();
router.use(requireFanboxAuth);

router.get("/", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await listProjects(tenantId, req.query);
    res.json({ data, total: data.length });
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
    const data = await createProject(tenantId, {
      ...req.body,
      createdBy: req.user?._id?.toString(),
    });
    res.status(201).json({ data });
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
    const data = await getProject(tenantId, req.params.id);
    res.json({ data });
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
    const data = await updateProject(tenantId, req.params.id, req.body ?? {});
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/:id([a-fA-F0-9]{24})/close", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await closeProject(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get("/:id([a-fA-F0-9]{24})/responses", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await listResponses(tenantId, req.params.id, req.query);
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
});

router.post("/:id([a-fA-F0-9]{24})/responses", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await submitResponse(tenantId, req.params.id, req.body ?? {});
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/:id([a-fA-F0-9]{24})/draw-winner", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const data = await drawRaffleWinner(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
