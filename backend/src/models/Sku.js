import mongoose from "mongoose";

const skuSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    skuCode: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    variantLabel: { type: String, trim: true },
    sizeLabel: { type: String, trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    minQty: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
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

skuSchema.index({ tenantId: 1, skuCode: 1 }, { unique: true });

export const Sku = mongoose.model("Sku", skuSchema);
