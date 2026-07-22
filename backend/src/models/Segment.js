import mongoose from "mongoose";

const segmentConditionSchema = new mongoose.Schema(
  {
    trait: { type: String },
    traitKey: { type: String },
    operator: {
      type: String,
      enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists"],
    },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const segmentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    logic: { type: String, enum: ["AND", "OR"], default: "AND" },
    rules: { type: [segmentConditionSchema], default: [] },
    conditions: { type: [segmentConditionSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "active",
    },
    memberCount: { type: Number, default: 0 },
    createdBy: { type: String },
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

segmentSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Segment = mongoose.model("Segment", segmentSchema);
