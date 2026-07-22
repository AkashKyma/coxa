import mongoose from "mongoose";

const loyaltyRuleSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    ruleType: {
      type: String,
      enum: [
        "earn_retail",
        "earn_fan_shop",
        "earn_ticket",
        "earn_attendance",
        "earn_merchandise",
        "earn_fnb",
        "earn_referral",
        "earn_annual_renewal",
        "earn_away_match",
        "earn_community_event",
        "earn_donation",
        "redeem_reward",
      ],
      required: true,
    },
    pointsPerReal: { type: Number, default: 1, min: 0 },
    pointsFlat: { type: Number, default: null, min: 0 },
    minAmountCents: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    description: { type: String, trim: true },
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

loyaltyRuleSchema.index({ tenantId: 1, ruleType: 1, status: 1 });
export const LoyaltyRule = mongoose.model("LoyaltyRule", loyaltyRuleSchema);
