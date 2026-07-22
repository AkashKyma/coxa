import mongoose from "mongoose";

const subjectLineSchema = new mongoose.Schema(
  {
    variant: { type: String, trim: true },
    text: { type: String, trim: true },
    previewText: { type: String, trim: true },
  },
  { _id: false },
);

const emailTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["transactional", "marketing", "lifecycle", "system"],
      default: "transactional",
    },
    subjectLines: [subjectLineSchema],
    mjmlSource: { type: String },
    compiledHtml: { type: String },
    plainTextFallback: { type: String },
    thumbnailUrl: { type: String, trim: true },
    locales: { type: [String], default: ["pt-BR"] },
    tokensUsed: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    archivedAt: { type: Date, default: null },
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

emailTemplateSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
emailTemplateSchema.index({ tenantId: 1, category: 1 });

export const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema);
