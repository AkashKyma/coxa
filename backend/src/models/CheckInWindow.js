import mongoose from "mongoose";

const checkInWindowSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    matchEventId: { type: mongoose.Schema.Types.ObjectId, ref: "MatchEvent", required: true, index: true },
    membershipPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "MembershipPlan", required: true },
    name: { type: String, required: true, trim: true },
    opensAt: { type: Date, required: true },
    closesAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 0 },
    checkedInCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["scheduled", "open", "closed"], default: "scheduled" },
    // Minimum fan score required to access this window (0 = open to all members)
    fanScoreMin: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.availableCount = Math.max(0, (ret.capacity ?? 0) - (ret.checkedInCount ?? 0));
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

checkInWindowSchema.index({ tenantId: 1, matchEventId: 1, membershipPlanId: 1 });

export const CheckInWindow = mongoose.model("CheckInWindow", checkInWindowSchema);
