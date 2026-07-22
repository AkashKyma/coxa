import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { DsrRequest } from "../../models/DsrRequest.js";
import { logAudit } from "../../middleware/auditLog.js";

const router = Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SLA_DAYS = 15;

/**
 * POST /api/v1/dsr/submit
 *
 * Public endpoint — a fan submits a Data Subject Request (DSR).
 * Sets the SLA deadline to submittedAt + 15 days (LGPD Art. 18).
 *
 * Body: { fanId, requestTypes: string[], fanEmail }
 * Returns: 201 + { id, slaDue }
 */
router.post("/submit", async (req, res, next) => {
  try {
    const { fanId, requestTypes, fanEmail } = req.body;

    if (!Array.isArray(requestTypes) || requestTypes.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "requestTypes must be a non-empty array",
      });
    }

    if (!fanEmail) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fanEmail is required",
      });
    }

    const submittedAt = new Date();
    const slaDue = new Date(submittedAt.getTime() + SLA_DAYS * MS_PER_DAY);

    // tenantId may come from req.ctx (tenant middleware) or fall back gracefully
    const tenantId = req?.ctx?.tenantId ?? "unknown";

    const dsrRequest = await DsrRequest.create({
      tenantId,
      fanId: fanId ?? undefined,
      requestTypes,
      fanEmail,
      submittedAt,
      slaDue,
      status: "submitted",
    });

    return res.status(201).json({
      data: { id: dsrRequest._id, slaDue: dsrRequest.slaDue, status: dsrRequest.status },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/dsr/my
 *
 * Authenticated endpoint — a fan retrieves their own DSR requests.
 * Uses req.user._id to match against fanId.
 *
 * Returns: { data: DsrRequest[] }
 */
router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const fanId = req.user._id;
    const tenantId = req.ctx?.tenantId ?? "unknown";

    const requests = await DsrRequest.find({ tenantId, fanId })
      .sort({ submittedAt: -1 })
      .lean();

    return res.json({ data: requests });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/dsr/admin/queue
 *
 * Admin endpoint — view all DSR requests for the tenant, sorted by SLA
 * deadline ascending (most urgent first).
 *
 * Query params: status, page (default 1), limit (default 20)
 * Returns: { data: DsrRequest[], total, page, limit }
 */
router.get("/admin/queue", requireAuth, async (req, res, next) => {
  try {
    const { tenantId } = req.ctx;
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { tenantId };
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [requests, total] = await Promise.all([
      DsrRequest.find(filter)
        .sort({ slaDue: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DsrRequest.countDocuments(filter),
    ]);

    return res.json({ data: requests, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/dsr/admin/:id/status
 *
 * Admin endpoint — update the status of a DSR request.
 * Optionally sets rejectedReason when status is "rejected".
 * Records the adminUserId performing the action.
 *
 * Body: { status, rejectedReason? }
 * Returns: 200 + updated DsrRequest
 */
router.patch("/admin/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectedReason } = req.body;
    const { tenantId } = req.ctx;

    if (!status) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "status is required" });
    }

    const update = { status, adminUserId: req.user._id };

    if (status === "rejected" && rejectedReason) {
      update.rejectedReason = rejectedReason;
    }
    if (status === "fulfilled") {
      update.fulfilledAt = new Date();
    }
    if (status === "verifying") {
      update.verifiedAt = new Date();
    }

    const existing = await DsrRequest.findOne({ _id: id, tenantId }).lean();
    if (!existing) {
      return res.status(404).json({ code: "NOT_FOUND", message: "DSR request not found" });
    }

    const updated = await DsrRequest.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: update },
      { new: true, runValidators: true },
    );

    await logAudit(
      req,
      "dsr.status.updated",
      "DsrRequest",
      id,
      { status: existing.status },
      { status: updated.status },
      status === "rejected" ? "warning" : "info",
    );

    return res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
