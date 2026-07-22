import mongoose from "mongoose";

const reservationLineSchema = new mongoose.Schema(
  {
    ticketProductId: { type: mongoose.Schema.Types.ObjectId, ref: "TicketProduct", required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ticketReservationSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    reservationNumber: { type: String, required: true },
    matchEventId: { type: mongoose.Schema.Types.ObjectId, ref: "MatchEvent", required: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", index: true },
    lines: { type: [reservationLineSchema], required: true },
    totalCents: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["active", "expired", "converted", "cancelled"],
      default: "active",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    idempotencyKey: { type: String, required: true },
    channel: { type: String, enum: ["fan_app", "box_office", "admin"], default: "fan_app" },
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

ticketReservationSchema.index({ tenantId: 1, reservationNumber: 1 }, { unique: true });
ticketReservationSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });

export const TicketReservation = mongoose.model("TicketReservation", ticketReservationSchema);
