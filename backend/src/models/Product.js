import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    productKind: {
      type: String,
      enum: ["merchandise", "ingredient", "menu_item"],
      default: "merchandise",
    },
    trackLots: { type: Boolean, default: false },
    storageClass: {
      type: String,
      enum: ["ambient", "chilled", "frozen"],
      default: "ambient",
    },
    defaultShelfLifeDays: { type: Number, min: 1 },
    sellByBufferDays: { type: Number, min: 0, default: 1 },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
    },
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

productSchema.index({ tenantId: 1, name: 1 });

export const Product = mongoose.model("Product", productSchema);
