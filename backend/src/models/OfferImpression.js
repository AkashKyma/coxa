import mongoose from "mongoose";

/**
 * OfferImpression — Phase 4
 *
 * Tracks every time an offer was shown or acted upon by a fan.
 * Used for:
 *  - Frequency capping (don't show same offer >3× in 7 days)
 *  - A/B variant tracking
 *  - Click-through / conversion attribution
 */
const offerImpressionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "FanProfile", required: true, index: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", required: true },
    // The A/B variant shown (e.g. "A", "B", "control")
    variant: { type: String, default: "control", trim: true },
    // Surface where the offer was shown: checkin_kiosk, fan_app, email, push, sms, whatsapp
    channel: { type: String, default: "fan_app", trim: true },
    // Outcome tracking
    clicked: { type: Boolean, default: false },
    converted: { type: Boolean, default: false },
    // ISO date when the offer was shown
    shownAt: { type: Date, default: Date.now },
    // Conversion recorded at
    convertedAt: { type: Date, default: null },
    // Revenue attributed to this impression (cents)
    attributedRevenueCents: { type: Number, default: 0 },
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

// Frequency-cap query: count impressions per fan+offer in last N days
offerImpressionSchema.index({ tenantId: 1, fanProfileId: 1, offerId: 1, shownAt: 1 });
// A/B variant analysis: group by offer + variant
offerImpressionSchema.index({ tenantId: 1, offerId: 1, variant: 1 });

export const OfferImpression = mongoose.model("OfferImpression", offerImpressionSchema);
