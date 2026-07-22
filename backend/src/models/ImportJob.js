import mongoose from "mongoose";

const importJobSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["cadastros", "leads"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
    rowsOk: { type: Number, default: 0, min: 0 },
    rowsFailed: { type: Number, default: 0, min: 0 },
    errorLog: { type: [String], default: [] },
    filename: { type: String, trim: true },
    createdBy: { type: String, trim: true },
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

importJobSchema.index({ tenantId: 1, createdAt: -1 });
importJobSchema.index({ tenantId: 1, type: 1, status: 1 });

export const ImportJob = mongoose.model("ImportJob", importJobSchema);
