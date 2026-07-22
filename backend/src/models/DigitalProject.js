import mongoose from "mongoose";

const projectQuestionSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true },
    label: { type: String, trim: true },
    type: { type: String, trim: true },
    required: { type: Boolean, default: false },
    options: [{ type: String, trim: true }],
  },
  { _id: false },
);

const digitalProjectSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["survey", "vote", "raffle", "contest", "nps"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "closed", "archived"],
      default: "draft",
      index: true,
    },
    questions: { type: [projectQuestionSchema], default: [] },
    schedule: { type: mongoose.Schema.Types.Mixed, default: {} },
    eligibility: { type: mongoose.Schema.Types.Mixed, default: {} },
    resultsMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
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

digitalProjectSchema.index({ tenantId: 1, type: 1, status: 1 });
digitalProjectSchema.index({ tenantId: 1, createdAt: -1 });

export const DigitalProject = mongoose.model("DigitalProject", digitalProjectSchema);
