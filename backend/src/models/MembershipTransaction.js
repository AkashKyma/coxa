import mongoose from "mongoose";

const membershipTransactionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      required: true,
      index: true,
    },
    membershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanMembership",
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["new", "renewal", "upgrade", "downgrade", "cancellation"],
      required: true,
    },
    planCode: { type: String, required: true, trim: true },
    amountCents: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["pix", "card", "boleto", "stub"],
      default: "stub",
    },
    paymentFrequency: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "completed",
    },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    idempotencyKey: { type: String, required: true },
    note: { type: String, trim: true },
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

membershipTransactionSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
membershipTransactionSchema.index({ tenantId: 1, fanProfileId: 1, createdAt: -1 });

export const MembershipTransaction = mongoose.model(
  "MembershipTransaction",
  membershipTransactionSchema,
);
