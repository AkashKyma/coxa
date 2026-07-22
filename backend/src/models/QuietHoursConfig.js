import mongoose from "mongoose";

const quietHoursConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    startHour: { type: Number, min: 0, max: 23, default: 22 },
    endHour: { type: Number, min: 0, max: 23, default: 8 },
    timezone: { type: String, default: "America/Sao_Paulo" },
    // Categories that bypass quiet hours entirely
    exemptCategories: {
      type: [String],
      default: ["matchday_critical", "transactional"],
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

export const QuietHoursConfig = mongoose.model("QuietHoursConfig", quietHoursConfigSchema);
