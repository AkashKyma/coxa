import mongoose from "mongoose";

const DSR_REQUEST_TYPES = [
  "access",
  "correction",
  "deletion",
  "portability",
  "anonymization",
  "opt_out",
  "revoke_consent",
  "restriction",
  "opposition",
  "information",
];

const DSR_STATUSES = [
  "submitted",
  "verifying",
  "in_progress",
  "fulfilled",
  "rejected",
  "cancelled",
];

const dsrRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile" },
    requestTypes: [{ type: String, enum: DSR_REQUEST_TYPES }],
    status: { type: String, enum: DSR_STATUSES, default: "submitted" },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    // SLA deadline: submittedAt + 15 days (LGPD Art. 18 response window)
    slaDue: { type: Date },
    fulfilledAt: { type: Date, default: null },
    rejectedReason: { type: String, trim: true },
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verificationMethod: {
      type: String,
      enum: ["email_otp", "totp", "manual"],
      default: null,
    },
    // URLs to evidence files (signed S3 / storage URLs)
    evidenceFiles: [{ type: String, trim: true }],
    // Snapshot of fan email at submission time — fan may change email later
    fanEmail: { type: String, trim: true, lowercase: true },
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

dsrRequestSchema.index({ tenantId: 1, status: 1 });
dsrRequestSchema.index({ fanId: 1 });
// slaDue ascending: surfaces most-urgent requests first in admin queue
dsrRequestSchema.index({ slaDue: 1 });

export const DsrRequest = mongoose.model("DsrRequest", dsrRequestSchema);
