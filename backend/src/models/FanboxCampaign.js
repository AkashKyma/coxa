import mongoose from "mongoose";

const fanboxCampaignSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["email", "sms", "push", "whatsapp", "broadcast"], required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "paused", "cancelled", "archived", "active", "pending_approval"],
      default: "draft",
      index: true,
    },
    channel: { type: String, trim: true },
    subject: { type: String, trim: true },
    bodyHtml: { type: String, trim: true },
    content: { type: String, trim: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "FanboxCampaignTemplate" },
    savedFilterId: { type: mongoose.Schema.Types.ObjectId, ref: "SavedFilter" },
    segmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Segment" },
    scheduledAt: { type: Date },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: String, trim: true },
    // ── Phase 4: AI Campaign fields ────────────────────────────────────────
    generatedByAi: { type: Boolean, default: false },
    aiObjective: { type: String, trim: true },
    targetingContext: { type: mongoose.Schema.Types.Mixed, default: null },
    approvalRequestedBy: { type: String, default: null },
    approvalRequestedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null },
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

fanboxCampaignSchema.index({ tenantId: 1, createdAt: -1 });
fanboxCampaignSchema.index({ tenantId: 1, status: 1 });
fanboxCampaignSchema.index({ tenantId: 1, generatedByAi: 1, status: 1 });

export const FanboxCampaign = mongoose.model("FanboxCampaign", fanboxCampaignSchema);
