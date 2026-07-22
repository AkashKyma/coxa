import mongoose from "mongoose";

const saleLineSchema = new mongoose.Schema(
  {
    skuId: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    skuCode: { type: String, required: true },
    productName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    lineTotalCents: { type: Number, required: true, min: 0 },
    // WS4 denormalized analytics fields — populated at write time so aggregations are index-friendly
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", index: true },
    categoryName: { type: String },
    sizeLabel: { type: String, trim: true },
    locationName: { type: String, trim: true },
    hourOfDay: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
  },
  { _id: false },
);

const saleSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    saleNumber: { type: String, required: true },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    lines: { type: [saleLineSchema], required: true },
    subtotalCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "paid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "pix", "stub"],
      default: "cash",
    },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", index: true },
    fanUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cashierUserId: { type: String },
    channel: {
      type: String,
      enum: ["pos", "fan_shop"],
      default: "pos",
      index: true,
    },
    status: {
      type: String,
      enum: ["completed", "voided"],
      default: "completed",
    },
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

saleSchema.index({ tenantId: 1, saleNumber: 1 }, { unique: true });
saleSchema.index({ tenantId: 1, createdAt: -1 });
saleSchema.index({ tenantId: 1, channel: 1, createdAt: -1 });
saleSchema.index({ tenantId: 1, locationId: 1, createdAt: -1 });
saleSchema.index({ "lines.categoryId": 1, tenantId: 1 });

export const Sale = mongoose.model("Sale", saleSchema);
