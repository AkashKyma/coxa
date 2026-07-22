import mongoose from "mongoose";

const stockLotSchema = new mongoose.Schema(
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
    lotNumber: { type: String, required: true, trim: true },
    purchaseDate: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    expirationDate: { type: Date, required: true },
    sellByDate: { type: Date, required: true },
    qtyOnHand: { type: Number, required: true, min: 0 },
    qtyReceived: { type: Number, required: true, min: 1 },
    unitCostCents: { type: Number, min: 0 },
    supplierName: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "depleted", "expired", "wasted", "quarantine"],
      default: "active",
      index: true,
    },
    wastageReason: { type: String, trim: true },
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

stockLotSchema.index({ tenantId: 1, locationId: 1, skuId: 1, lotNumber: 1 }, { unique: true });
stockLotSchema.index({ tenantId: 1, sellByDate: 1, status: 1 });
stockLotSchema.index({ tenantId: 1, expirationDate: 1, status: 1 });

export const StockLot = mongoose.model("StockLot", stockLotSchema);
