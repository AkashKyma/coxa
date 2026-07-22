import mongoose from "mongoose";

const frequencyCapSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    channel: {
      type: String,
      enum: ["email", "sms", "push", "whatsapp"],
      required: true,
    },
    category: {
      type: String,
      enum: ["marketing", "transactional", "matchday_critical"],
      required: true,
    },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    count: { type: Number, default: 0 },
    maxAllowed: { type: Number, required: true },
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

frequencyCapSchema.index({ tenantId: 1, fanId: 1, channel: 1, category: 1, windowEnd: 1 });

export const FrequencyCap = mongoose.model("FrequencyCap", frequencyCapSchema);
