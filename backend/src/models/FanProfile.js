import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: "BR" },
  },
  { _id: false },
);

const fanProfileSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    fanId: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    cpf: { type: String, trim: true, index: true, sparse: true },
    passport: { type: String, trim: true, sparse: true },
    /** WS6 — true if profile holder is not a Brazilian resident requiring CPF */
    isForeigner: { type: Boolean, default: false, index: true },
    gender: { type: String, enum: ["male", "female", "other", "unknown", "prefer_not_to_say", "non_binary"], default: "unknown" },
    birthDate: { type: Date },
    dateOfBirth: { type: Date },
    favoritePlayer: { type: String, trim: true },
    jerseySize: { type: String, enum: ["PP", "P", "M", "G", "GG", "XGG", ""] },
    preferredLanguage: { type: String, default: "pt-BR" },
    address: addressSchema,
    hasChildren: { type: String, enum: ["yes", "no", "unknown"], default: "unknown" },
    ageRange: { type: String, trim: true },
    householdIncomeBand: { type: String, trim: true },
    preferredSocialNetwork: { type: String, trim: true },
    sportsBetting: { type: Boolean, default: false },
    affinityClubId: { type: String, trim: true },
    biometricRegistered: { type: Boolean, default: false },
    primaryInteractionChannels: [{ type: String, trim: true }],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    memberId: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive", "merged", "lead"],
      default: "active",
    },
    // ── Phase 3: ML Scores (written back by Dagster nightly) ─────────────────
    churnRiskScore: { type: Number, default: null, min: 0, max: 1 },
    ticketPropensity: { type: Number, default: null, min: 0, max: 1 },
    retailPropensity: { type: Number, default: null, min: 0, max: 1 },
    nextBestChannel: {
      type: String,
      enum: ["push", "email", "whatsapp", "sms", null],
      default: null,
    },
    mlScoresUpdatedAt: { type: Date, default: null },
    // Push notification tokens
    pushTokens: [
      {
        token: { type: String, required: true },
        type: { type: String, enum: ["web", "android", "ios"], default: "web" },
        userAgent: { type: String },
        registeredAt: { type: Date, default: Date.now },
      },
    ],
    // Email preferences
    emailOptOut: { type: Boolean, default: false },
    emailOptOutAt: { type: Date, default: null },
    // Club-editable metadata
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true, maxlength: 1000 },
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

fanProfileSchema.index({ tenantId: 1, fanId: 1 }, { unique: true });
fanProfileSchema.index({ tenantId: 1, email: 1 }, { unique: true });
fanProfileSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
fanProfileSchema.index({ tenantId: 1, status: 1, cpf: 1 }, { sparse: true });
fanProfileSchema.index({ tenantId: 1, status: 1, "address.city": 1 });

export const FanProfile = mongoose.model("FanProfile", fanProfileSchema);
