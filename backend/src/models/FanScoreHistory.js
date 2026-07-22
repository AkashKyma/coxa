import mongoose from "mongoose";

const fanScoreHistorySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      required: true,
      index: true,
    },
    previousScore: { type: Number, required: true },
    newScore: { type: Number, required: true },
    delta: { type: Number, required: true },
    previousTier: { type: String },
    newTier: { type: String },
    reason: { type: String, required: true, trim: true },
    referenceId: { type: String },
    calculatedAt: { type: Date, default: Date.now },
    // Snapshot of component scores at this point in time
    components: {
      attendanceScore: Number,
      tenureScore: Number,
      spendingScore: Number,
      referralScore: Number,
      engagementScore: Number,
      donationScore: Number,
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

fanScoreHistorySchema.index({ tenantId: 1, fanProfileId: 1, calculatedAt: -1 });

export const FanScoreHistory = mongoose.model("FanScoreHistory", fanScoreHistorySchema);
