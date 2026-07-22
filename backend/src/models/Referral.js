import mongoose from "mongoose";
import crypto from "node:crypto";

const referralSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    referrerFanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      required: true,
      index: true,
    },
    refereeFanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      index: true,
    },
    referralCode: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rewarded", "expired"],
      default: "pending",
      index: true,
    },
    confirmedAt: { type: Date },
    rewardedAt: { type: Date },
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

referralSchema.index({ tenantId: 1, referralCode: 1 }, { unique: true });
referralSchema.index({ tenantId: 1, referrerFanProfileId: 1, refereeFanProfileId: 1 });

export function generateReferralCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export const Referral = mongoose.model("Referral", referralSchema);
