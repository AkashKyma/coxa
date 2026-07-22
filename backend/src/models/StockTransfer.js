import mongoose from "mongoose";

const transferLineSchema = new mongoose.Schema(
  {
    skuId: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    skuCode: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const stockTransferSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    transferNumber: { type: String, required: true },
    fromLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    toLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    lines: { type: [transferLineSchema], required: true },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ["completed", "cancelled"],
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

stockTransferSchema.index({ tenantId: 1, transferNumber: 1 }, { unique: true });

export const StockTransfer = mongoose.model("StockTransfer", stockTransferSchema);
