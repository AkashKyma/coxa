import mongoose from "mongoose";

const returnLineSchema = new mongoose.Schema(
  {
    skuId: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    skuCode: { type: String, required: true },
    productName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    lineTotalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const retailReturnSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    returnNumber: { type: String, required: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    saleNumber: { type: String, required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    reason: { type: String, trim: true },
    lines: { type: [returnLineSchema], required: true },
    totalCents: { type: Number, required: true, min: 0 },
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

retailReturnSchema.index({ tenantId: 1, returnNumber: 1 }, { unique: true });

export const RetailReturn = mongoose.model("RetailReturn", retailReturnSchema);
