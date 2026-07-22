import { Router } from "express";
import KPI_REGISTRY, { getKpisByDepartment } from "../lib/kpiRegistry.js";
import FILTER_FIELDS, { getFilterFieldsByDepartment } from "../lib/filterFields.js";
import { listIndustryProfiles, getProfileCatalog } from "../lib/industryProfiles.js";

const router = Router();

/** GET /api/v1/meta/kpis — full KPI catalog (optionally filtered by department/tier/industry) */
router.get("/kpis", (req, res) => {
  const { department, tier, industry } = req.query;
  let kpis = KPI_REGISTRY;
  if (industry) kpis = kpis.filter((k) => k.industry.includes(industry));
  if (department) kpis = kpis.filter((k) => k.department === department);
  if (tier) kpis = kpis.filter((k) => k.tier === tier);
  res.json({ kpis, total: kpis.length });
});

/** GET /api/v1/meta/filter-fields — whitelisted filterable fields */
router.get("/filter-fields", (req, res) => {
  const { department, industry } = req.query;
  let fields = FILTER_FIELDS;
  if (industry) fields = fields.filter((f) => f.industry.includes(industry));
  if (department) fields = fields.filter((f) => f.department === department);
  res.json({ fields, total: fields.length });
});

/** GET /api/v1/meta/industry-profiles — list all industry profiles */
router.get("/industry-profiles", (_req, res) => {
  res.json({ profiles: listIndustryProfiles() });
});

/** GET /api/v1/meta/industry-profiles/:code — get KPIs + filter fields for a profile */
router.get("/industry-profiles/:code", (req, res) => {
  try {
    const catalog = getProfileCatalog(req.params.code);
    res.json({ data: catalog });
  } catch (err) {
    res.status(404).json({ code: "NOT_FOUND", message: err.message });
  }
});

export default router;
