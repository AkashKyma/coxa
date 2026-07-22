import mongoose from "mongoose";

const fanTraitSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    traitKey: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    computedAt: { type: Date, default: Date.now },
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

fanTraitSchema.index({ tenantId: 1, fanProfileId: 1, traitKey: 1 }, { unique: true });

export const FanTrait = mongoose.model("FanTrait", fanTraitSchema);
