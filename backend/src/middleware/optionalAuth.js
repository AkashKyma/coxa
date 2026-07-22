import { verifyToken } from "../config/jwt.js";
import { User } from "../models/User.js";

/**
 * Optional auth — attaches req.user when a valid Bearer token is present.
 * Does not fail when token is missing (for public/tenant-scoped endpoints).
 */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    const user = await User.findById(payload.userId);
    if (user?.status === "active") {
      req.user = user;
      req.ctx.userId = user._id.toString();
    }
  } catch {
    // ignore invalid tokens for optional auth
  }

  next();
}
