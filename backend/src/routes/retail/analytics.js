import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getRetailSummary, getTopProducts, getRevenueByLocation } from "../../services/cubeAnalyticsService.js";
import { backfillSaleLineDenormalization } from "../../services/retailAnalyticsService.js";
import { resolvePeriod } from "../../services/periodService.js";

const router = Router();
router.use(requireAuth);

function tid(req) { return req.ctx?.tenantId; }

router.get("/summary", async (req, res, next) => {
  try {
    const { channel = "pos", from, to, preset } = req.query;
    const period = resolvePeriod({ from, to, preset });
    const data = await getRetailSummary(tid(req), channel, period);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/top-products", async (req, res, next) => {
  try {
    const { channel = "pos", from, to, preset, limit = 10 } = req.query;
    const period = resolvePeriod({ from, to, preset });
    const data = await getTopProducts(tid(req), channel, { ...period, limit: Number(limit) });
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

router.get("/by-location", async (req, res, next) => {
  try {
    const { from, to, preset } = req.query;
    const period = resolvePeriod({ from, to, preset });
    const data = await getRevenueByLocation(tid(req), period);
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

/** Admin-only: backfill denormalized fields — use once after schema migration */
router.post("/admin/backfill-denorm", async (req, res, next) => {
  try {
    const { dryRun = true } = req.body;
    const result = await backfillSaleLineDenormalization(tid(req), { dryRun: Boolean(dryRun) });
    res.json({ result });
  } catch (err) { next(err); }
});

export default router;
