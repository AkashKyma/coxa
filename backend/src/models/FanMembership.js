import mongoose from "mongoose";

const fanMembershipSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPlan",
      required: true,
    },
    planCode: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "suspended", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    paymentFrequency: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
    joinDate: { type: Date, required: true },
    renewalDate: { type: Date, required: true },
    cancelledAt: { type: Date },
    autoRenew: { type: Boolean, default: true },
    memberNumber: { type: String, trim: true },
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

// One active membership record per fan (allow multiple for history; enforce active uniqueness in service layer)
fanMembershipSchema.index({ tenantId: 1, fanProfileId: 1, status: 1 });
fanMembershipSchema.index({ tenantId: 1, memberNumber: 1 }, { unique: true, sparse: true });

export const FanMembership = mongoose.model("FanMembership", fanMembershipSchema);
