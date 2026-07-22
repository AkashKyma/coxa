import { Router } from "express";
import { createHash } from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { ConsentRecord } from "../../models/ConsentRecord.js";
import { logAudit } from "../../middleware/auditLog.js";

const router = Router();

// All consent routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/consent/record
 *
 * Record a new consent event for a fan. Computes an evidence hash (SHA-256)
 * over the core consent fields so the entry is tamper-evident.
 *
 * Body: { fanId, purpose, legalBasis, status, source, policyVersion, channelSpecific }
 * Returns: 201 + created ConsentRecord
 */
router.post("/record", async (req, res, next) => {
  try {
    const {
      fanId,
      purpose,
      legalBasis,
      status = "granted",
      source = "api",
      policyVersion,
      channelSpecific,
    } = req.body;

    if (!fanId || !purpose || !legalBasis || !policyVersion) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fanId, purpose, legalBasis, and policyVersion are required",
      });
    }

    const timestamp = Date.now();
    const evidenceHash = createHash("sha256")
      .update(JSON.stringify({ fanId, purpose, legalBasis, status, timestamp }))
      .digest("hex");

    const record = await ConsentRecord.create({
      tenantId: req.ctx.tenantId,
      fanId,
      purpose,
      legalBasis,
      status,
      source,
      policyVersion,
      ipAddress: req.ip,
      evidenceHash,
      channelSpecific: channelSpecific ?? null,
      grantedAt: status === "granted" ? new Date(timestamp) : undefined,
      revokedAt: status === "revoked" ? new Date(timestamp) : undefined,
    });

    await logAudit(
      req,
      "consent.recorded",
      "ConsentRecord",
      record._id,
      null,
      { purpose, legalBasis, status, policyVersion },
    );

    return res.status(201).json({ data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/consent/fan/:fanId
 *
 * Retrieve all consent records for a fan, grouped by purpose.
 * Returns only the latest record per purpose (most recently created).
 *
 * Returns: { data: { [purpose]: ConsentRecord } }
 */
router.get("/fan/:fanId", async (req, res, next) => {
  try {
    const { fanId } = req.params;
    const { tenantId } = req.ctx;

    const records = await ConsentRecord.find({ tenantId, fanId })
      .sort({ createdAt: -1 })
      .lean();

    // Keep only the most recent record per purpose
    const grouped = {};
    for (const record of records) {
      if (!grouped[record.purpose]) {
        grouped[record.purpose] = record;
      }
    }

    return res.json({ data: grouped, fanId });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/consent/bulk-check
 *
 * Check whether a fan has active (granted) consent for a list of purposes.
 * Called by the Universal Message Router before any outbound send.
 *
 * Body: { fanId, purposes: string[] }
 * Returns: { data: { [purpose]: boolean } }
 */
router.post("/bulk-check", async (req, res, next) => {
  try {
    const { fanId, purposes } = req.body;
    const { tenantId } = req.ctx;

    if (!fanId || !Array.isArray(purposes) || purposes.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fanId and a non-empty purposes array are required",
      });
    }

    // Fetch only granted records for the requested purposes
    const records = await ConsentRecord.find({
      tenantId,
      fanId,
      purpose: { $in: purposes },
      status: "granted",
    })
      .sort({ createdAt: -1 })
      .lean();

    // Build a set of purposes with at least one granted record
    const grantedSet = new Set(records.map((r) => r.purpose));

    const result = {};
    for (const purpose of purposes) {
      result[purpose] = grantedSet.has(purpose);
    }

    return res.json({ data: result, fanId });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/consent/fan/:fanId/purpose/:purpose
 *
 * Revoke consent for a specific purpose. Finds the latest active (granted)
 * ConsentRecord for the fan + purpose and marks it revoked.
 *
 * Returns: 200 + updated record, or 404 if no active record exists.
 */
router.delete("/fan/:fanId/purpose/:purpose", async (req, res, next) => {
  try {
    const { fanId, purpose } = req.params;
    const { tenantId } = req.ctx;

    const record = await ConsentRecord.findOneAndUpdate(
      { tenantId, fanId, purpose, status: "granted" },
      { $set: { status: "revoked", revokedAt: new Date() } },
      { new: true, sort: { createdAt: -1 } },
    );

    if (!record) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "No active consent record found for this fan and purpose",
      });
    }

    await logAudit(
      req,
      "consent.revoked",
      "ConsentRecord",
      record._id,
      { status: "granted" },
      { status: "revoked", revokedAt: record.revokedAt },
      "warning",
    );

    return res.json({ data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
