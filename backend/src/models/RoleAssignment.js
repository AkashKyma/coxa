import mongoose from "mongoose";

const roleAssignmentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roleCode: { type: String, required: true, index: true },
    moduleCode: { type: String },
    locationId: { type: mongoose.Schema.Types.ObjectId },
    vendorId: { type: mongoose.Schema.Types.ObjectId },
    status: {
      type: String,
      enum: ["active", "suspended", "revoked"],
      default: "active",
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revokedAt: { type: Date },
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

roleAssignmentSchema.index({ tenantId: 1, userId: 1 });

export const RoleAssignment = mongoose.model("RoleAssignment", roleAssignmentSchema);
