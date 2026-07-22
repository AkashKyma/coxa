import mongoose from "mongoose";

const tierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    minPoints: { type: Number, required: true, default: 0 },
    maxPoints: { type: Number, default: null },
    color: { type: String, default: "#0C6B3A" },
    benefits: [{ type: String, trim: true }],
  },
  { _id: false },
);

const tierConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    tiers: { type: [tierSchema], default: [] },
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

export const TierConfig = mongoose.model("TierConfig", tierConfigSchema);
