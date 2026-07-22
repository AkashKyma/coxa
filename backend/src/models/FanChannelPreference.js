import mongoose from "mongoose";

const channelPreferenceSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    categories: { type: [String], default: [] },
  },
  { _id: false },
);

const fanChannelPreferenceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    preferences: {
      email:    { type: channelPreferenceSchema, default: () => ({ enabled: true, categories: [] }) },
      sms:      { type: channelPreferenceSchema, default: () => ({ enabled: true, categories: [] }) },
      push:     { type: channelPreferenceSchema, default: () => ({ enabled: true, categories: [] }) },
      whatsapp: { type: channelPreferenceSchema, default: () => ({ enabled: true, categories: [] }) },
      in_app:   { type: channelPreferenceSchema, default: () => ({ enabled: true, categories: [] }) },
    },
    globalFrequency: {
      type: String,
      enum: ["all", "daily_digest", "weekly", "important_only"],
      default: "all",
    },
    updatedAt: { type: Date },
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

fanChannelPreferenceSchema.index({ tenantId: 1, fanId: 1 }, { unique: true });

export const FanChannelPreference = mongoose.model("FanChannelPreference", fanChannelPreferenceSchema);
