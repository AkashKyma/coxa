import mongoose from "mongoose";

const channelSuppressionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", index: true },
    channel: {
      type: String,
      enum: ["email", "sms", "push", "whatsapp"],
      required: true,
    },
    emailAddress: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    reason: {
      type: String,
      enum: ["bounce", "complaint", "unsubscribe", "manual", "hard_bounce", "spam"],
      required: true,
    },
    suppressedAt: { type: Date, default: Date.now },
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

channelSuppressionSchema.index({ tenantId: 1, fanId: 1, channel: 1 }, { unique: true });
channelSuppressionSchema.index({ tenantId: 1, emailAddress: 1 });

export const ChannelSuppression = mongoose.model("ChannelSuppression", channelSuppressionSchema);
