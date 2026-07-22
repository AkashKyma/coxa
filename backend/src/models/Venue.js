import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 0 },
    sectionType: {
      type: String,
      enum: ["general", "vip", "hospitality", "standing", "accessibility"],
      default: "general",
    },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
  },
  { _id: true },
);

const venueSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    sections: { type: [sectionSchema], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.sections) {
          ret.sections = ret.sections.map((s) => ({
            ...s,
            id: s._id?.toString(),
            _id: undefined,
          }));
        }
        return ret;
      },
    },
  },
);

venueSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const Venue = mongoose.model("Venue", venueSchema);
