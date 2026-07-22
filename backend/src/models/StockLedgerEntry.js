import mongoose from "mongoose";

const stockLedgerEntrySchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["receive", "sale", "adjustment", "transfer", "return"],
      required: true,
    },
    qtyDelta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    referenceType: { type: String },
    referenceId: { type: String },
    note: { type: String },
    createdBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockLedgerEntrySchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const StockLedgerEntry = mongoose.model("StockLedgerEntry", stockLedgerEntrySchema);
