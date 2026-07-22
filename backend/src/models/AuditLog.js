import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Snapshot of actor email at action time — avoids join on deleted user
    actorEmail: { type: String, trim: true },
    actorRole: { type: String, trim: true },
    // Dot-notation action name, e.g. "fan.profile.updated", "consent.revoked"
    action: { type: String, required: true, trim: true },
    // Mongoose model name of the affected resource
    resourceType: { type: String, trim: true },
    // String representation of the resource _id
    resourceId: { type: String, trim: true },
    // Snapshot of document state before the change (secrets must be stripped by caller)
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    // Snapshot of document state after the change
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "info" },
    // NOTE: For financial / LGPD compliance records the recommended retention period
    // is 5 years (157,680,000 seconds). A MongoDB TTL index on createdAt would enforce
    // this automatically, but it is intentionally NOT set here — retention policy
    // should be managed at the operational level per tenant agreement to avoid
    // accidental deletion of records under active legal holds.
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    // Disable automatic timestamps — we control createdAt manually above
    timestamps: false,
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

// Primary query pattern: all logs for a tenant ordered by recency
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
// Drill-down: find all audit events touching a specific resource
auditLogSchema.index({ tenantId: 1, resourceType: 1, resourceId: 1 });
// Actor-centric view: all actions performed by a specific user
auditLogSchema.index({ actorId: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
