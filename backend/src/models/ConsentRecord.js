import mongoose from "mongoose";

// 11-purpose registry:
// marketing, analytics, personalization, third_party_sharing,
// push_notifications, sms, whatsapp, email_marketing, profiling,
// biometric, minor_protection
//
// 8 legal bases from LGPD Art. 7:
// consent, contract, legal_obligation, vital_interests,
// legitimate_interests, exercise_of_rights, research, credit_protection

const PURPOSES = [
  "marketing",
  "analytics",
  "personalization",
  "third_party_sharing",
  "push_notifications",
  "sms",
  "whatsapp",
  "email_marketing",
  "profiling",
  "biometric",
  "minor_protection",
];

const LEGAL_BASES = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "legitimate_interests",
  "exercise_of_rights",
  "research",
  "credit_protection",
];

const consentRecordSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    purpose: { type: String, enum: PURPOSES, required: true },
    legalBasis: { type: String, enum: LEGAL_BASES, required: true },
    status: { type: String, enum: ["granted", "revoked", "pending"], default: "granted" },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    source: {
      type: String,
      enum: ["fan_portal", "admin", "import", "api", "migration"],
      default: "api",
    },
    policyVersion: { type: String, required: true },
    ipAddress: { type: String, trim: true },
    // SHA-256 of the consent event payload — computed server-side at record time
    evidenceHash: { type: String, trim: true },
    // For sponsor-specific or channel-specific consent metadata
    channelSpecific: { type: mongoose.Schema.Types.Mixed, default: null },
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

// Compound index for consent lookup by tenant + fan + purpose
consentRecordSchema.index({ tenantId: 1, fanId: 1, purpose: 1 });
// Index for tenant-wide status queries (e.g. audit sweeps)
consentRecordSchema.index({ tenantId: 1, status: 1 });

export const ConsentRecord = mongoose.model("ConsentRecord", consentRecordSchema);
