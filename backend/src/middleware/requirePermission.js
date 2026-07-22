import { hasPermission } from "@coxa/rbac";

/**
 * Express middleware that checks the authenticated user has the required permission.
 *
 * Usage:
 *   router.get("/kpis", requirePermission("analytics.view"), handler)
 *
 * It reads `req.fanboxStaff` (set by requireFanboxAuth) or `req.user`
 * and checks PERMISSION_MATRIX + per-user overrides.
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.fanboxStaff ?? req.user;
    if (!user) {
      return res.status(401).json({ code: "UNAUTHENTICATED", message: "Authentication required." });
    }

    const roles = user.roles ?? (user.role ? [user.role] : []);
    const overrides = user.permissionOverrides ?? {};

    if (!hasPermission(roles, permission, overrides)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: `Permission required: ${permission}`,
        permission,
      });
    }

    next();
  };
}
