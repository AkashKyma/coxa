import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { FanProfile } from "../models/FanProfile.js";
import { buildProfileQuery } from "../services/fanboxFilterService.js";

const router = Router();
router.use(requireAuth);

function csvEscape(value) {
  if (value == null) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (!/[,"\n]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

const FAN_CSV_HEADERS = ["fanId", "fullName", "email", "phone", "cpf", "isForeigner", "status", "gender", "ageRange", "city", "state", "country", "createdAt"];

/**
 * POST /api/v1/exports/fans
 * Body: { rules: [...filterRules], limit?: number }
 * Returns CSV synchronously for up to 50k rows.
 * For larger exports a background job should be triggered (future: queue + S3 presigned URL).
 */
router.post("/fans", async (req, res, next) => {
  try {
    const tenantId = req.ctx?.tenantId;
    const { rules = [], limit = 50000 } = req.body;

    const query = buildProfileQuery(tenantId, rules);
    const total = await FanProfile.countDocuments(query);

    if (total > Number(limit)) {
      return res.status(422).json({
        code: "EXPORT_TOO_LARGE",
        message: `Export would return ${total} rows. Maximum is ${limit}. Apply more filters to reduce the result set.`,
        total,
        limit: Number(limit),
      });
    }

    const fans = await FanProfile.find(query)
      .sort({ createdAt: -1 })
      .select("fanId fullName email phone cpf isForeigner status gender ageRange address.city address.state address.country createdAt")
      .lean();

    const rows = fans.map((f) =>
      [
        f.fanId, f.fullName, f.email, f.phone, f.cpf, f.isForeigner,
        f.status, f.gender, f.ageRange,
        f.address?.city, f.address?.state, f.address?.country,
        f.createdAt?.toISOString?.() ?? "",
      ].map(csvEscape).join(","),
    );

    const csv = [FAN_CSV_HEADERS.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fans-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

export default router;
