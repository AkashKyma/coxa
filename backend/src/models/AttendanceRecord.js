import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    matchEventId: { type: mongoose.Schema.Types.ObjectId, ref: "MatchEvent", required: true, index: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", index: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
    entitlementId: { type: mongoose.Schema.Types.ObjectId, ref: "Entitlement" },
    attendanceStatus: {
      type: String,
      enum: ["present", "no_show", "checked_in_only"],
      required: true,
      index: true,
    },
    entryMethod: { type: String, enum: ["qr", "nfc", "face", "manual_override", "check_in"], default: "qr" },
    recordedAt: { type: Date, default: Date.now },
    gateId: { type: String, trim: true },
    note: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true },
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

attendanceRecordSchema.index({ tenantId: 1, matchEventId: 1, fanProfileId: 1 });
attendanceRecordSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
);

export const AttendanceRecord = mongoose.model("AttendanceRecord", attendanceRecordSchema);
