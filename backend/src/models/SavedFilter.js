import mongoose from "mongoose";

const savedFilterRuleSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    operator: {
      type: String,
      enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists", "in"],
      required: true,
    },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const savedFilterSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    rules: { type: [savedFilterRuleSchema], default: [] },
    createdBy: { type: String, trim: true },
    lastRunCount: { type: Number, default: 0, min: 0 },
    lastRunAt: { type: Date },
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

savedFilterSchema.index({ tenantId: 1, name: 1 }, { unique: true });
savedFilterSchema.index({ tenantId: 1, createdAt: -1 });

export const SavedFilter = mongoose.model("SavedFilter", savedFilterSchema);
