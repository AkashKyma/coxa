import mongoose from "mongoose";

/**
 * Tracked social channel for a club.
 * source: 'instagram' | 'twitter_x' | 'youtube' | 'tiktok' | 'facebook'
 */
const socialChannelSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ["instagram", "twitter_x", "youtube", "tiktok", "facebook"],
      required: true,
    },
    channelHandle: { type: String, required: true, trim: true },
    channelId: { type: String, trim: true },
    displayName: { type: String, trim: true },
    profileImageUrl: { type: String },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    authToken: { type: String, select: false },
    lastFetchedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; },
    },
  },
);

socialChannelSchema.index({ tenantId: 1, source: 1, channelHandle: 1 }, { unique: true });

export const SocialChannel = mongoose.model("SocialChannel", socialChannelSchema);

// ────────────────────────────────────────────────────────────────────────────

/**
 * Periodic snapshot of channel-level metrics (followers, impressions, etc.).
 * One document per channel per day.
 */
const socialMetricSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "SocialChannel", required: true, index: true },
    source: { type: String, required: true },
    date: { type: Date, required: true },
    followersCount: { type: Number, default: 0 },
    followersGrowth: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    engagements: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    engagementRatePct: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; },
    },
  },
);

socialMetricSchema.index({ tenantId: 1, channelId: 1, date: 1 }, { unique: true });
socialMetricSchema.index({ tenantId: 1, source: 1, date: -1 });

export const SocialMetric = mongoose.model("SocialMetric", socialMetricSchema);

// ────────────────────────────────────────────────────────────────────────────

/**
 * Individual social post/content item.
 */
const socialPostSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "SocialChannel", required: true, index: true },
    source: { type: String, required: true },
    postId: { type: String, required: true },
    postUrl: { type: String },
    caption: { type: String },
    mediaType: { type: String, enum: ["image", "video", "reel", "story", "tweet", "short", "text", "other"] },
    postedAt: { type: Date, index: true },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    engagementRatePct: { type: Number, default: 0 },
    thumbnailUrl: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; },
    },
  },
);

socialPostSchema.index({ tenantId: 1, channelId: 1, postId: 1 }, { unique: true });
socialPostSchema.index({ tenantId: 1, source: 1, postedAt: -1 });

export const SocialPost = mongoose.model("SocialPost", socialPostSchema);
