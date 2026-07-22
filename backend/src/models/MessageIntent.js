import mongoose from "mongoose";

const messageIntentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    intent: { type: String, required: true },
    category: {
      type: String,
      enum: ["transactional", "marketing", "matchday_critical", "system"],
      required: true,
    },
    // Channel-agnostic payload: { title, body, data, tokens }
    payload: { type: mongoose.Schema.Types.Mixed },
    // Explicit channel override — bypasses cascade logic when set
    preferredChannel: { type: String },
    status: {
      type: String,
      enum: ["pending", "routed", "sent", "failed", "suppressed", "quiet_hours"],
      default: "pending",
    },
    // Populated after routing
    selectedChannel: { type: String },
    routedAt: { type: Date },
    failReason: { type: String },
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

messageIntentSchema.index({ tenantId: 1, fanId: 1, createdAt: -1 });
messageIntentSchema.index({ tenantId: 1, status: 1 });

export const MessageIntent = mongoose.model("MessageIntent", messageIntentSchema);
