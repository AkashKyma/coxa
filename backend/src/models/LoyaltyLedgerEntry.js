import mongoose from "mongoose";

const loyaltyLedgerEntrySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    entryType: {
      type: String,
      enum: ["earn", "redeem", "adjust", "expire", "reverse"],
      required: true,
    },
    pointsDelta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    referenceType: { type: String },
    referenceId: { type: String },
    idempotencyKey: { type: String, required: true },
    note: { type: String, trim: true },
    createdBy: { type: String },
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

loyaltyLedgerEntrySchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
loyaltyLedgerEntrySchema.index({ tenantId: 1, fanProfileId: 1, createdAt: -1 });

export const LoyaltyLedgerEntry = mongoose.model("LoyaltyLedgerEntry", loyaltyLedgerEntrySchema);
