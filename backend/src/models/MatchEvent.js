import mongoose from "mongoose";

const matchEventSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    eventCode: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    eventType: {
      type: String,
      enum: ["match", "concert", "activation", "hospitality", "parking"],
      default: "match",
    },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true, index: true },
    homeTeam: { type: String, trim: true },
    awayTeam: { type: String, trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    gatesOpenAt: { type: Date },
    saleStartsAt: { type: Date },
    saleEndsAt: { type: Date },
    capacity: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "on_sale", "sold_out", "completed", "cancelled"],
      default: "draft",
      index: true,
    },
    createdBy: { type: String },
    updatedBy: { type: String },
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

matchEventSchema.index({ tenantId: 1, eventCode: 1 }, { unique: true });
matchEventSchema.index({ tenantId: 1, startsAt: 1, status: 1 });

export const MatchEvent = mongoose.model("MatchEvent", matchEventSchema);
