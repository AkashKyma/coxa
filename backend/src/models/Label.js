import mongoose from "mongoose";

/**
 * Label — custom tag/category definition.
 * Labels can be applied to any entity type via EntityLabel.
 */
const labelSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    color: { type: String, default: "#16a34a" },
    description: { type: String, trim: true },
    /** Which entity types this label can be applied to */
    applicableTo: {
      type: [String],
      enum: ["fan", "product", "sale", "ticket", "member", "location", "campaign"],
      default: ["fan"],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; },
    },
  },
);

labelSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

export const Label = mongoose.model("Label", labelSchema);

// ────────────────────────────────────────────────────────────────────────────

/**
 * EntityLabel — join table: attaches a Label to an entity document.
 */
const entityLabelSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    labelId: { type: mongoose.Schema.Types.ObjectId, ref: "Label", required: true, index: true },
    entityType: {
      type: String,
      required: true,
      enum: ["fan", "product", "sale", "ticket", "member", "location", "campaign"],
      index: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; },
    },
  },
);

entityLabelSchema.index({ tenantId: 1, entityType: 1, entityId: 1, labelId: 1 }, { unique: true });
entityLabelSchema.index({ tenantId: 1, labelId: 1, entityType: 1 });

export const EntityLabel = mongoose.model("EntityLabel", entityLabelSchema);
