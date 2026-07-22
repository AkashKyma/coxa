import mongoose from "mongoose";

const emailSendSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "EmailCampaign", default: null },
    transactionalKey: { type: String, trim: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    emailAddress: { type: String, required: true, lowercase: true, trim: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "EmailTemplate" },
    variantServed: { type: String, trim: true },
    subjectServed: { type: String, trim: true },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "bounced", "failed", "suppressed"],
      default: "queued",
    },
    softBounceCount: { type: Number, default: 0 },
    providerMessageId: { type: String, trim: true },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    suppressedReason: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
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

emailSendSchema.index({ tenantId: 1, campaignId: 1 });
emailSendSchema.index({ fanId: 1, sentAt: -1 });
emailSendSchema.index({ providerMessageId: 1 }, { unique: true, sparse: true });

export const EmailSend = mongoose.model("EmailSend", emailSendSchema);
