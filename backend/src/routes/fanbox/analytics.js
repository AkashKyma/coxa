import { Router } from "express";
import { requireFanboxAuth } from "../../middleware/requireFanboxAuth.js";
import {
  getEngagementReports,
  getFanCounters,
  getFanGrowth,
  getSpendReports,
  getLoyaltyReports,
  getMemberReports,
  getRetailSummary,
  getTopProducts,
  getRevenueByLocation,
  getFanDemographics,
  getBusinessReport,
} from "../../services/cubeAnalyticsService.js";
import { getAllAdvancedKpis } from "../../services/advancedKpiService.js";
import { resolvePeriod } from "../../services/periodService.js";

const router = Router();
router.use(requireFanboxAuth);

function tenant(req, res) {
  const id = req.ctx?.tenantId;
  if (!id) {
    res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    return null;
  }
  return id;
}

// ── Fan Base ──────────────────────────────────────────────────────────────────

router.get("/fan-counters", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getFanCounters(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/fan-growth", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getFanGrowth(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/fan-demographics", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getFanDemographics(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Engagement & Attendance ───────────────────────────────────────────────────

router.get("/engagement-reports", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getEngagementReports(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Revenue & Spend ───────────────────────────────────────────────────────────

router.get("/spend-reports", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getSpendReports(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Membership ────────────────────────────────────────────────────────────────

router.get("/member-reports", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getMemberReports(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Loyalty ───────────────────────────────────────────────────────────────────

router.get("/loyalty-reports", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getLoyaltyReports(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Retail ────────────────────────────────────────────────────────────────────

router.get("/retail-summary", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const { channel = "pos" } = req.query;
    const period = resolvePeriod(req.query);
    const data = await getRetailSummary(tenantId, channel, period);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/top-products", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const { channel = "pos", limit } = req.query;
    const period = resolvePeriod(req.query);
    const data = await getTopProducts(tenantId, channel, { ...period, limit: Number(limit ?? 10) });
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/revenue-by-location", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getRevenueByLocation(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Business Source Reports ───────────────────────────────────────────────────

router.get("/business/:source", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getBusinessReport(tenantId, req.params.source, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Advanced KPI Bundle (all departments) ─────────────────────────────────────

router.get("/advanced", async (req, res, next) => {
  try {
    const tenantId = tenant(req, res); if (!tenantId) return;
    const period = resolvePeriod(req.query);
    const data = await getAllAdvancedKpis(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
