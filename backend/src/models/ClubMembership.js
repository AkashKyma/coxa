import mongoose from "mongoose";
import { CLUB_MEMBERSHIP_ROLE_CODES } from "../lib/clubMembershipRoles.js";

/**
 * ClubMembership links a User to a Club with a role.
 * The club creator gets role "owner". Invited staff use @coxa/rbac role codes
 * (e.g. marketing_manager, ticketing_manager) plus legacy admin | member.
 */
const clubMembershipSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: CLUB_MEMBERSHIP_ROLE_CODES,
      default: "member",
    },
    moduleAccess: {
      type: [String],
      default: [],
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

clubMembershipSchema.index({ clubId: 1, userId: 1 }, { unique: true });

export const ClubMembership = mongoose.model("ClubMembership", clubMembershipSchema);
