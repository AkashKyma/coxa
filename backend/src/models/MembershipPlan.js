import mongoose from "mongoose";

const membershipPlanSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    planCode: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    tierLevel: { type: Number, default: 1, min: 1 },
    description: { type: String, trim: true },
    benefits: { type: [String], default: [] },
    priorityOrder: { type: Number, default: 100 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    // Pricing
    monthlyPriceCents: { type: Number, default: 0, min: 0 },
    annualPriceCents: { type: Number, default: 0, min: 0 },
    // Seating
    seatType: { type: String, enum: ["none", "general", "assigned", "vip"], default: "general" },
    sectorCode: { type: String, trim: true },
    // Priority engine base score — combined with fan score for window eligibility
    priorityBase: { type: Number, default: 100, min: 0 },
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

membershipPlanSchema.index({ tenantId: 1, planCode: 1 }, { unique: true });

export const MembershipPlan = mongoose.model("MembershipPlan", membershipPlanSchema);
