import mongoose from "mongoose";

const loyaltyRewardSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    rewardType: {
      type: String,
      enum: ["discount", "merchandise", "fnb", "experience", "voucher"],
      default: "voucher",
    },
    pointsCost: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    inventoryLimit: { type: Number, min: 0 },
    redeemedCount: { type: Number, default: 0, min: 0 },
    validFrom: { type: Date },
    validUntil: { type: Date },
    terms: { type: String, trim: true },
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

loyaltyRewardSchema.index({ tenantId: 1, code: 1 }, { unique: true });
loyaltyRewardSchema.index({ tenantId: 1, status: 1 });

loyaltyRewardSchema.virtual("remainingInventory").get(function remainingInventory() {
  if (this.inventoryLimit == null) return null;
  return Math.max(0, this.inventoryLimit - (this.redeemedCount ?? 0));
});

export const LoyaltyReward = mongoose.model("LoyaltyReward", loyaltyRewardSchema);
