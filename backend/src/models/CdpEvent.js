import mongoose from "mongoose";

const cdpEventSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    eventName: { type: String, required: true, index: true },
    source: { type: String, required: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", index: true },
    idempotencyKey: { type: String, required: true },
    eventTimestamp: { type: Date, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    payloadVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["accepted", "rejected", "dlq"],
      default: "accepted",
      index: true,
    },
    rejectionReason: { type: String },
    processedAt: { type: Date },
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

cdpEventSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
cdpEventSchema.index({ tenantId: 1, createdAt: -1 });

export const CdpEvent = mongoose.model("CdpEvent", cdpEventSchema);
