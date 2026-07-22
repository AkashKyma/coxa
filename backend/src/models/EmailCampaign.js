import mongoose from "mongoose";

const abVariantSchema = new mongoose.Schema(
  {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "EmailTemplate" },
    subjectVariant: { type: String, trim: true },
    splitPct: { type: Number },
  },
  { _id: false },
);

const abTestSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    variants: [abVariantSchema],
    winningMetric: {
      type: String,
      enum: ["open_rate", "click_rate", "revenue"],
    },
    sampleSizePct: { type: Number },
    autoPromoteAt: { type: Date },
  },
  { _id: false },
);

const utmParamsSchema = new mongoose.Schema(
  {
    source: { type: String, trim: true },
    medium: { type: String, trim: true },
    campaign: { type: String, trim: true },
  },
  { _id: false },
);

const statsSchema = new mongoose.Schema(
  {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    complained: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    revenueAttributedCents: { type: Number, default: 0 },
  },
  { _id: false },
);

const emailCampaignSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "EmailTemplate", required: true },
    senderName: { type: String, trim: true },
    senderEmail: { type: String, trim: true, lowercase: true },
    replyTo: { type: String, trim: true, lowercase: true },
    audienceSegmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Segment" },
    excludeSegmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Segment" }],
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "paused", "cancelled"],
      default: "draft",
    },
    scheduledAt: { type: Date },
    timezone: { type: String, default: "America/Sao_Paulo" },
    abTest: { type: abTestSchema, default: () => ({}) },
    sendTimeOptimization: { type: Boolean, default: false },
    frequencyCapOverride: { type: Boolean, default: false },
    utmParams: { type: utmParamsSchema, default: () => ({}) },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stats: { type: statsSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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

emailCampaignSchema.index({ tenantId: 1, status: 1 });
emailCampaignSchema.index({ tenantId: 1, scheduledAt: 1 });

export const EmailCampaign = mongoose.model("EmailCampaign", emailCampaignSchema);
