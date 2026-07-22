import mongoose from "mongoose";
import crypto from "crypto";

const ticketSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    ticketNumber: { type: String, required: true },
    matchEventId: { type: mongoose.Schema.Types.ObjectId, ref: "MatchEvent", required: true, index: true },
    ticketProductId: { type: mongoose.Schema.Types.ObjectId, ref: "TicketProduct", required: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", index: true },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "TicketReservation" },
    sectionCode: { type: String, trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    qrToken: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["issued", "used", "cancelled", "transferred"],
      default: "issued",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "paid",
    },
    paymentMethod: { type: String, enum: ["pix", "card", "cash", "stub"], default: "stub" },
    channel: { type: String, enum: ["fan_app", "box_office", "admin"], default: "fan_app" },
    issuedAt: { type: Date, default: Date.now },
    usedAt: { type: Date },
    cancelledAt: { type: Date },
    idempotencyKey: { type: String, required: true },
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

ticketSchema.index({ tenantId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
ticketSchema.index({ tenantId: 1, qrToken: 1 }, { unique: true });

export function generateQrToken() {
  return crypto.randomBytes(16).toString("hex");
}

export const Ticket = mongoose.model("Ticket", ticketSchema);
