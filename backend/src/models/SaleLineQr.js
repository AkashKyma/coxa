import mongoose from "mongoose";

const saleLineQrSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    /** 0-based index of the line within Sale.lines */
    saleLineIndex: { type: Number, required: true },
    skuId: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    productName: { type: String, default: "" },
    /** 0-based unit index within the line qty (0 … qty-1) */
    unitIndex: { type: Number, required: true },
    qrToken: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["issued", "redeemed", "voided"],
      default: "issued",
      index: true,
    },
    redeemedAt: { type: Date },
    redeemedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const SaleLineQr = mongoose.model("SaleLineQr", saleLineQrSchema);
