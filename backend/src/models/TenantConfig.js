import mongoose from "mongoose";

const tenantConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    clubName: { type: String, required: true, trim: true },
    enabledModules: { type: [String], default: [] },
    currency: { type: String, default: "BRL" },
    timezone: { type: String, default: "America/Sao_Paulo" },
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

export const TenantConfig = mongoose.model("TenantConfig", tenantConfigSchema);
