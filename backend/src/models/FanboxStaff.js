import mongoose from "mongoose";
import { FANBOX_ROLE_CODES } from "../lib/fanboxRoles.js";

/**
 * FanBox staff membership — separate from ClubMembership.
 * Users can have FanBox access without club-dashboard access (and vice versa).
 */
const fanboxStaffSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: FANBOX_ROLE_CODES,
      required: true,
    },
    /** Optional per-user module overrides (empty = role defaults) */
    moduleAccess: { type: [String], default: [] },
    /** WS5 — per-user permission overrides: { allow: ['analytics.view'], deny: ['fans.delete'] } */
    permissionOverrides: {
      type: {
        allow: { type: [String], default: [] },
        deny: { type: [String], default: [] },
      },
      default: () => ({ allow: [], deny: [] }),
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["active", "invited", "suspended", "removed"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

fanboxStaffSchema.index({ clubId: 1, userId: 1 }, { unique: true });
fanboxStaffSchema.index({ clubId: 1, status: 1, role: 1 });

export const FanboxStaff = mongoose.model("FanboxStaff", fanboxStaffSchema);
