import mongoose from "mongoose";

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    country: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    sport: { type: String, default: "Football", trim: true },
    stadiumName: { type: String, trim: true },
    website: { type: String, trim: true },
    size: {
      type: String,
      enum: ["small", "medium", "large", "professional"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: String, index: true, trim: true },
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

export const Club = mongoose.model("Club", clubSchema);
