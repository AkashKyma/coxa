import mongoose from "mongoose";

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 5001,
  gold: 15001,
  platinum: 35001,
  diamond: 60001,
};

function scoreToTier(score) {
  if (score >= TIER_THRESHOLDS.diamond) return "diamond";
  if (score >= TIER_THRESHOLDS.platinum) return "platinum";
  if (score >= TIER_THRESHOLDS.gold) return "gold";
  if (score >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

const fanScoreSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      required: true,
    },
    totalScore: { type: Number, default: 0, min: 0 },
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum", "diamond"],
      default: "bronze",
    },
    // Component scores stored for transparency and debugging
    attendanceScore: { type: Number, default: 0 },
    tenureScore: { type: Number, default: 0 },
    spendingScore: { type: Number, default: 0 },
    referralScore: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 },
    donationScore: { type: Number, default: 0 },
    lastCalculatedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 0 },
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

fanScoreSchema.index({ tenantId: 1, fanProfileId: 1 }, { unique: true });
// Descending score index used by priority engine to sort fans
fanScoreSchema.index({ tenantId: 1, totalScore: -1 });

fanScoreSchema.statics.tierThresholds = TIER_THRESHOLDS;
fanScoreSchema.statics.scoreToTier = scoreToTier;

export const FanScore = mongoose.model("FanScore", fanScoreSchema);
