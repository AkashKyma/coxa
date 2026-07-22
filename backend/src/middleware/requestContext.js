/**
 * Injects tenant and request context from headers.
 * API gateway / auth middleware will set these in production.
 */
export function requestContext(req, _res, next) {
  req.ctx = {
    tenantId:
      req.headers["x-tenant-id"] ??
      process.env.DEFAULT_TENANT_ID ??
      "coxa-club-001",
    requestId: req.headers["x-request-id"] ?? crypto.randomUUID(),
    userId: req.headers["x-user-id"],
    locationId: req.headers["x-location-id"],
    moduleCode: req.headers["x-module-code"],
    vendorId: req.headers["x-vendor-id"],
  };
  next();
}
