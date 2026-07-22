import mongoose from "mongoose";

const stockBalanceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    skuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sku",
      required: true,
      index: true,
    },
    qtyOnHand: { type: Number, required: true, min: 0, default: 0 },
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

stockBalanceSchema.index({ tenantId: 1, locationId: 1, skuId: 1 }, { unique: true });

export const StockBalance = mongoose.model("StockBalance", stockBalanceSchema);
