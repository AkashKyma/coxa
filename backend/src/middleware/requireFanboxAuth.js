import { verifyToken } from "../config/jwt.js";
import { User } from "../models/User.js";
import { FanboxStaff } from "../models/FanboxStaff.js";

async function loadFanboxUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return { error: { status: 401, code: "UNAUTHORIZED", message: "Authentication required" } };
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);

    if (payload.accountType && payload.accountType !== "fanbox") {
      return { error: { status: 401, code: "INVALID_TOKEN", message: "FanBox session required" } };
    }

    const user = await User.findById(payload.userId);
    if (!user || user.status !== "active") {
      return { error: { status: 401, code: "UNAUTHORIZED", message: "User not found or inactive" } };
    }

    req.user = user;
    req.tokenClubId = payload.clubId ?? null;
    return { user };
  } catch {
    return { error: { status: 401, code: "TOKEN_INVALID", message: "Token invalid or expired" } };
  }
}

/** Validates FanBox JWT — club context optional (for /me, /clubs). */
export async function requireFanboxToken(req, res, next) {
  const result = await loadFanboxUser(req);
  if (result.error) {
    return res.status(result.error.status).json({
      code: result.error.code,
      message: result.error.message,
    });
  }
  next();
}

/** Validates FanBox JWT + active FanboxStaff for X-Club-Id. */
export async function requireFanboxAuth(req, res, next) {
  const result = await loadFanboxUser(req);
  if (result.error) {
    return res.status(result.error.status).json({
      code: result.error.code,
      message: result.error.message,
    });
  }

  const clubId = req.headers["x-club-id"] ?? req.tokenClubId ?? null;
  if (!clubId) {
    return res.status(400).json({ code: "CLUB_REQUIRED", message: "X-Club-Id header required" });
  }

  let fanboxStaff;
  try {
    fanboxStaff = await FanboxStaff.findOne({
      userId: req.user._id,
      clubId,
      status: "active",
    });
  } catch {
    return res.status(403).json({ code: "FORBIDDEN", message: "Invalid club identifier" });
  }

  if (!fanboxStaff) {
    return res.status(403).json({ code: "FORBIDDEN", message: "No active FanBox access for this club" });
  }

  req.fanboxStaff = fanboxStaff;
  req.clubId = clubId;
  req.membership = { role: fanboxStaff.role, moduleAccess: fanboxStaff.moduleAccess };
  next();
}

export function requireFanboxStaffManager(req, res, next) {
  if (!req.fanboxStaff) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Club context required" });
  }
  if (req.fanboxStaff.role !== "fanbox_admin") {
    return res.status(403).json({ code: "FORBIDDEN", message: "Requires FanBox administrator role" });
  }
  next();
}
