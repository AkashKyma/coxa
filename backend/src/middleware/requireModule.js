import { TenantConfig } from "../models/TenantConfig.js";

/**
 * Ensures a module is enabled for the request tenant.
 */
export function requireModule(moduleCode) {
  return async (req, res, next) => {
    try {
      const config = await TenantConfig.findOne({ tenantId: req.ctx.tenantId });
      if (!config?.enabledModules?.includes(moduleCode)) {
        return res.status(403).json({
          code: "MODULE_DISABLED",
          message: `Module "${moduleCode}" is not enabled for this tenant`,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
