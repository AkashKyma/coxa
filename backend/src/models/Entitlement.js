import mongoose from "mongoose";

const entitlementSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    entitlementCode: { type: String, required: true },
    matchEventId: { type: mongoose.Schema.Types.ObjectId, ref: "MatchEvent", required: true, index: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", index: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", index: true },
    sourceType: {
      type: String,
      enum: ["ticket_purchase", "member_check_in", "sponsor_allocation", "manual"],
      required: true,
    },
    sectionCode: { type: String, trim: true },
    qrToken: { type: String, index: true },
    status: {
      type: String,
      enum: ["active", "used", "expired", "revoked"],
      default: "active",
      index: true,
    },
    validFrom: { type: Date },
    validUntil: { type: Date },
    usedAt: { type: Date },
    gateId: { type: String, trim: true },
    deviceId: { type: String, trim: true },
    overrideReason: { type: String, trim: true },
    overrideBy: { type: String, trim: true },
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

entitlementSchema.index({ tenantId: 1, entitlementCode: 1 }, { unique: true });
entitlementSchema.index({ tenantId: 1, qrToken: 1 });

export const Entitlement = mongoose.model("Entitlement", entitlementSchema);
