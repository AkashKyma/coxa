import mongoose from "mongoose";

const digitalProjectResponseSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DigitalProject",
      required: true,
      index: true,
    },
    fanProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FanProfile",
      required: true,
      index: true,
    },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    optionId: { type: String, trim: true },
    npsScore: { type: Number, min: 0, max: 10 },
    createdAt: { type: Date, default: Date.now },
  },
  {
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

digitalProjectResponseSchema.index({ projectId: 1, fanProfileId: 1 });
digitalProjectResponseSchema.index({ projectId: 1, createdAt: -1 });

export const DigitalProjectResponse = mongoose.model("DigitalProjectResponse", digitalProjectResponseSchema);
