import mongoose from "mongoose";

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["trigger", "send_email", "send_push", "send_sms", "wait", "condition", "ab_split", "end"],
      required: true,
    },
    label: { type: String },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
  },
  { _id: false }
);

const edgeSchema = new mongoose.Schema(
  {
    id: { type: String },
    source: { type: String },
    target: { type: String },
    label: { type: String },
  },
  { _id: false }
);

const journeySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "archived"],
      default: "draft",
    },
    trigger: {
      type: {
        type: String,
        enum: ["event", "schedule", "segment_enter", "segment_exit", "manual"],
        required: true,
      },
      eventName: { type: String },
      segmentId: { type: mongoose.Schema.Types.ObjectId },
      cronExpression: { type: String },
    },
    nodes: { type: [nodeSchema], default: [] },
    edges: { type: [edgeSchema], default: [] },
    stats: {
      entered: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      exited: { type: Number, default: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

journeySchema.index({ tenantId: 1, status: 1 });
journeySchema.index({ tenantId: 1, createdAt: -1 });

export const Journey = mongoose.model("Journey", journeySchema);
