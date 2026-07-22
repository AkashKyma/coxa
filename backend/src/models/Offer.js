import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    offerType: {
      type: String,
      enum: ["discount_percent", "discount_fixed", "bundle", "bonus_points", "free_shipping", "voucher"],
      required: true,
    },
    value: { type: Number, default: 0 },
    productHint: { type: String, trim: true },
    // Segment this offer targets — null means it's the default/fallback
    segmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Segment", default: null },
    segmentName: { type: String, trim: true, default: null },
    // Minimum loyalty points balance required
    minPoints: { type: Number, default: 0 },
    // Priority order: lower number = evaluated first
    priority: { type: Number, default: 100 },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "active",
    },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
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

offerSchema.index({ tenantId: 1, status: 1, priority: 1 });
offerSchema.index({ tenantId: 1, segmentId: 1 });

export const Offer = mongoose.model("Offer", offerSchema);
