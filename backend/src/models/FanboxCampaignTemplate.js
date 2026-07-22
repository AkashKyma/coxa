import mongoose from "mongoose";

const fanboxCampaignTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, trim: true },
    bodyHtml: { type: String, required: true, trim: true },
    createdBy: { type: String, trim: true },
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

fanboxCampaignTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });
fanboxCampaignTemplateSchema.index({ tenantId: 1, createdAt: -1 });

export const FanboxCampaignTemplate = mongoose.model("FanboxCampaignTemplate", fanboxCampaignTemplateSchema);
