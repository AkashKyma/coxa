import { verifyToken } from "../config/jwt.js";
import { User } from "../models/User.js";
import { ClubMembership } from "../models/ClubMembership.js";
import { canManageClubMembers } from "../lib/clubMembershipRoles.js";

/**
 * Validates the Bearer JWT and attaches req.user, req.membership, req.clubId.
 *
 * Club context resolution order:
 *   1. X-Club-Id request header  (club-switcher sends this after the user picks a club)
 *   2. clubId embedded in the JWT (set on login to the first/last active club)
 *
 * This lets the frontend switch clubs without re-issuing a token.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);

    const user = await User.findById(payload.userId);
    if (!user || user.status !== "active") {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "User not found or inactive" });
    }

    // X-Club-Id header overrides the JWT clubId — used by the club-switcher.
    const clubId = req.headers["x-club-id"] ?? payload.clubId ?? null;
    let membership = null;

    if (clubId) {
      membership = await ClubMembership.findOne({
        userId: user._id,
        clubId,
        status: "active",
      });
      if (!membership) {
        return res.status(403).json({ code: "FORBIDDEN", message: "No active membership for this club" });
      }
    }

    req.user = user;
    req.membership = membership;
    req.clubId = clubId;
    next();
  } catch {
    res.status(401).json({ code: "TOKEN_INVALID", message: "Token invalid or expired" });
  }
}

/**
 * Require one or more roles within the resolved club context.
 * Must be used after requireAuth.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.membership) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Club context required" });
    }
    if (!roles.includes(req.membership.role)) {
      return res.status(403).json({ code: "FORBIDDEN", message: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}

/** Staff with user-management access (invite, change role, remove). */
export function requireMemberManager(req, res, next) {
  if (!req.membership) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Club context required" });
  }
  if (!canManageClubMembers(req.membership.role)) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Requires staff management permission" });
  }
  next();
}
