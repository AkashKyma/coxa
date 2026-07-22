import { Router } from "express";
import { TenantConfig } from "../../models/TenantConfig.js";
import { requireModule } from "../../middleware/requireModule.js";
import authRouter from "./auth.js";
import staffRouter from "./staff.js";
import analyticsRouter from "./analytics.js";
import fansRouter from "./fans.js";
import intelligenceRouter from "./intelligence.js";
import campaignsRouter from "./campaigns.js";
import projectsRouter from "./projects.js";
import importRouter from "./import.js";
import aiRouter from "./ai.js";

const router = Router();

router.get("/status", async (req, res, next) => {
  try {
    const config = await TenantConfig.findOne({ tenantId: req.ctx.tenantId });
    res.json({
      module: "fanbox",
      enabled: config?.enabledModules?.includes("fanbox") ?? false,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

/** FanBox auth — login/me before module gate */
router.use("/auth", authRouter);

router.use(requireModule("fanbox"));
router.use("/staff", staffRouter);
router.use("/analytics", analyticsRouter);
router.use("/fans", fansRouter);
router.use("/intelligence", intelligenceRouter);
router.use("/campaigns", campaignsRouter);
router.use("/projects", projectsRouter);
router.use("/import", importRouter);
router.use("/ai", aiRouter);

export default router;
