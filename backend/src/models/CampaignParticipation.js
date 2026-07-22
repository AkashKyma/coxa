import mongoose from "mongoose";

const campaignParticipationSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      required: true,
      index: true,
    },
    campaignId: { type: String, required: true, trim: true },
    campaignName: { type: String, required: true, trim: true },
    participationType: {
      type: String,
      enum: ["referral", "purchase", "event", "donation", "social"],
      required: true,
    },
    pointsAwarded: { type: Number, default: 0, min: 0 },
    scoreAwarded: { type: Number, default: 0, min: 0 },
    amountCents: { type: Number, default: 0, min: 0 },
    participatedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
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

campaignParticipationSchema.index({ tenantId: 1, fanProfileId: 1, createdAt: -1 });
campaignParticipationSchema.index({ tenantId: 1, campaignId: 1 });

export const CampaignParticipation = mongoose.model(
  "CampaignParticipation",
  campaignParticipationSchema,
);
