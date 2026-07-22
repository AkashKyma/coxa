/**
 * Club Analytics Routes — /api/v1/club/analytics
 *
 * Operational KPI endpoints for the club-dashboard.
 * Backed by cubeAnalyticsService (ClickHouse → MongoDB fallback).
 *
 * These endpoints are protected by the existing club auth token
 * and scoped to the active tenantId from X-Club-Id header.
 *
 * Endpoints:
 *   GET /api/v1/club/analytics/retail          → retail KPIs (POS + fan-shop)
 *   GET /api/v1/club/analytics/retail/top-products
 *   GET /api/v1/club/analytics/retail/by-location
 *   GET /api/v1/club/analytics/fnb             → F&B sales KPIs
 *   GET /api/v1/club/analytics/ticketing        → tickets + check-in KPIs
 *   GET /api/v1/club/analytics/membership       → member KPIs
 *   GET /api/v1/club/analytics/loyalty          → loyalty program KPIs
 *   GET /api/v1/club/analytics/overview         → combined top-line snapshot
 */
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  getRetailSummary,
  getTopProducts,
  getRevenueByLocation,
  getMemberReports,
  getLoyaltyReports,
  getEngagementReports,
  getSpendReports,
  getBusinessReport,
} from "../../services/cubeAnalyticsService.js";
import { resolvePeriod } from "../../services/periodService.js";

const router = Router();
router.use(requireAuth);

function tid(req) { return req.ctx?.tenantId; }

function missingTenant(res) {
  res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
}

// ── Retail ────────────────────────────────────────────────────────────────────

router.get("/retail", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const { channel = "pos" } = req.query;
    const period = resolvePeriod(req.query);
    const data = await getRetailSummary(tenantId, channel, period);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/retail/top-products", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const { channel = "pos", limit = 10 } = req.query;
    const period = resolvePeriod(req.query);
    const data = await getTopProducts(tenantId, channel, { ...period, limit: Number(limit) });
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

router.get("/retail/by-location", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const period = resolvePeriod(req.query);
    const data = await getRevenueByLocation(tenantId, period);
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

// ── F&B ───────────────────────────────────────────────────────────────────────
// F&B sales are stored with channel "pos" but at locations with type "fnb_stand".
// We delegate to getBusinessReport with source "coxa-foods" which handles
// the correct location-type filter in fanboxAnalyticsService.

router.get("/fnb", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const period = resolvePeriod(req.query);
    // "coxa-foods" source maps to channel "pos" + fnb_stand location filter
    const data = await getBusinessReport(tenantId, "coxa-foods", period);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/fnb/top-products", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const { limit = 10 } = req.query;
    const period = resolvePeriod(req.query);
    const data = await getTopProducts(tenantId, "pos", { ...period, limit: Number(limit) });
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

// ── Ticketing / Check-in ──────────────────────────────────────────────────────

router.get("/ticketing", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const period = resolvePeriod(req.query);
    const data = await getEngagementReports(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Membership ────────────────────────────────────────────────────────────────

router.get("/membership", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const period = resolvePeriod(req.query);
    const data = await getMemberReports(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Loyalty ───────────────────────────────────────────────────────────────────

router.get("/loyalty", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const period = resolvePeriod(req.query);
    const data = await getLoyaltyReports(tenantId, period);
    res.json({ data });
  } catch (err) { next(err); }
});

// ── Overview (combined top-line snapshot) ─────────────────────────────────────

router.get("/overview", async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) return missingTenant(res);
    const period = resolvePeriod(req.query);

    const [retail, fnb, ticketing, membership, loyalty, revenue] = await Promise.allSettled([
      getRetailSummary(tenantId, "pos", period),
      getRetailSummary(tenantId, "fnb", period),
      getEngagementReports(tenantId, period),
      getMemberReports(tenantId, period),
      getLoyaltyReports(tenantId, period),
      getSpendReports(tenantId, period),
    ]);

    res.json({
      data: {
        retail:     retail.status === "fulfilled"     ? retail.value     : null,
        fnb:        fnb.status === "fulfilled"        ? fnb.value        : null,
        ticketing:  ticketing.status === "fulfilled"  ? ticketing.value  : null,
        membership: membership.status === "fulfilled" ? membership.value : null,
        loyalty:    loyalty.status === "fulfilled"    ? loyalty.value    : null,
        revenue:    revenue.status === "fulfilled"    ? revenue.value    : null,
        _period: period,
      },
    });
  } catch (err) { next(err); }
});

export default router;
