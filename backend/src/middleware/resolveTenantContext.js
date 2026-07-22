import mongoose from "mongoose";
import { Club } from "../models/Club.js";
import { TenantConfig } from "../models/TenantConfig.js";

/**
 * Resolves tenantId from X-Club-Id header and attaches club context.
 * Falls back to x-tenant-id / DEFAULT_TENANT_ID from requestContext.
 */
export async function resolveTenantContext(req, _res, next) {
  try {
    const clubId = req.headers["x-club-id"];
    if (clubId && mongoose.isValidObjectId(clubId)) {
      const club = await Club.findById(clubId);
      if (club?.tenantId) {
        req.ctx.tenantId = club.tenantId;
        req.ctx.clubId = club.id;
      } else if (club) {
        const config = await TenantConfig.findOne({ clubName: club.name });
        if (config) {
          req.ctx.tenantId = config.tenantId;
          if (!club.tenantId) {
            club.tenantId = config.tenantId;
            await club.save();
          }
        }
      }
    }

    if (req.user) {
      req.ctx.userId = req.user._id.toString();
    }

    next();
  } catch (err) {
    next(err);
  }
}
