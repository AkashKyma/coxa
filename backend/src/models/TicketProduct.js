import mongoose from "mongoose";

const ticketProductSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    matchEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MatchEvent",
      required: true,
      index: true,
    },
    productCode: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId },
    sectionCode: { type: String, trim: true },
    audienceType: {
      type: String,
      enum: ["public", "member", "guest", "vip", "hospitality"],
      default: "public",
    },
    priceCents: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
    reservedCount: { type: Number, default: 0, min: 0 },
    maxPerOrder: { type: Number, default: 6, min: 1 },
    requiresMemberId: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "sold_out"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.availableCount = Math.max(
          0,
          (ret.capacity ?? 0) - (ret.soldCount ?? 0) - (ret.reservedCount ?? 0),
        );
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

ticketProductSchema.index({ tenantId: 1, matchEventId: 1, productCode: 1 }, { unique: true });

export const TicketProduct = mongoose.model("TicketProduct", ticketProductSchema);
