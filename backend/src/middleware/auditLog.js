import { AuditLog } from "../models/AuditLog.js";

/**
 * Persist a single audit log entry.
 *
 * Never throws — on failure it logs to console.error so the caller's
 * happy-path is never interrupted by an audit write failure.
 *
 * @param {import("express").Request} req   - Express request (supplies actor + tenant context)
 * @param {string}  action       - Dot-notation action name, e.g. "fan.profile.updated"
 * @param {string}  resourceType - Mongoose model name of affected resource, e.g. "FanProfile"
 * @param {string}  resourceId   - String _id of the affected document
 * @param {*}       before       - Document snapshot before change (caller strips secrets)
 * @param {*}       after        - Document snapshot after change
 * @param {string}  [severity]   - "info" | "warning" | "critical"  (default: "info")
 */
export async function logAudit(
  req,
  action,
  resourceType,
  resourceId,
  before,
  after,
  severity = "info",
) {
  try {
    const actor = req?.user ?? null;
    const tenantId = req?.ctx?.tenantId ?? "unknown";

    await AuditLog.create({
      tenantId,
      actorId: actor?._id ?? null,
      actorEmail: actor?.email ?? null,
      actorRole: req?.membership?.role ?? actor?.role ?? null,
      action,
      resourceType: resourceType ?? null,
      resourceId: resourceId ? String(resourceId) : null,
      before: before ?? null,
      after: after ?? null,
      ipAddress: req?.ip ?? null,
      userAgent: req?.headers?.["user-agent"] ?? null,
      severity,
    });
  } catch (err) {
    console.error("[auditLog] Failed to write audit log:", err?.message ?? err);
  }
}

/**
 * Returns an Express middleware that fires an audit log entry after
 * the response has been sent (non-blocking, uses the "finish" event).
 *
 * Usage:
 *   router.post("/something", requireAuth, auditMiddleware("thing.created", (req) => req.params.id), handler)
 *
 * @param {string}   action         - Dot-notation action label
 * @param {Function} [getResourceId] - Optional fn(req, res) → string resource id
 * @param {string}   [resourceType] - Mongoose model name
 * @param {string}   [severity]     - "info" | "warning" | "critical"
 */
export function auditMiddleware(action, getResourceId, resourceType, severity = "info") {
  return (req, res, next) => {
    res.on("finish", () => {
      const resourceId =
        typeof getResourceId === "function" ? getResourceId(req, res) : (req.params?.id ?? null);
      // Fire-and-forget; logAudit never throws
      logAudit(req, action, resourceType ?? null, resourceId, null, null, severity);
    });
    next();
  };
}
