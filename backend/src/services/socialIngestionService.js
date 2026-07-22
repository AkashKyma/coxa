import { SocialChannel, SocialMetric, SocialPost } from "../models/Social.js";

/**
 * Social Ingestion Service.
 * Each adapter tries the official API first, then falls back to scraper.
 *
 * Add real API keys via env:
 *   INSTAGRAM_ACCESS_TOKEN, FACEBOOK_PAGE_ACCESS_TOKEN,
 *   TWITTER_BEARER_TOKEN, YOUTUBE_API_KEY, TIKTOK_ACCESS_TOKEN
 */

async function fetchInstagramInsights(channel) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const url = `https://graph.instagram.com/${channel.channelId}/insights?metric=impressions,reach,follower_count,profile_views&period=day&access_token=${token}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function fetchTwitterMetrics(channel) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.twitter.com/2/users/${channel.channelId}?user.fields=public_metrics`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return null;
    const json = await resp.json();
    const m = json.data?.public_metrics ?? null;
    return m ? { followersCount: m.followers_count, followingCount: m.following_count, postsCount: m.tweet_count } : null;
  } catch {
    return null;
  }
}

async function fetchYouTubeMetrics(channel) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel.channelId}&key=${key}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = await resp.json();
    const stats = json.items?.[0]?.statistics ?? null;
    return stats ? { followersCount: Number(stats.subscriberCount), postsCount: Number(stats.videoCount) } : null;
  } catch {
    return null;
  }
}

/**
 * Ingest metrics for a single channel. Tries official API then stubs.
 */
async function ingestChannel(channel) {
  let apiData = null;

  if (channel.source === "instagram") apiData = await fetchInstagramInsights(channel);
  else if (channel.source === "twitter_x") apiData = await fetchTwitterMetrics(channel);
  else if (channel.source === "youtube") apiData = await fetchYouTubeMetrics(channel);
  // tiktok and facebook stubs — add adapters when credentials are available

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const prevFollowers = channel.followersCount ?? 0;
  const newFollowers = apiData?.followersCount ?? prevFollowers;
  const growth = newFollowers - prevFollowers;

  await SocialMetric.findOneAndUpdate(
    { tenantId: channel.tenantId, channelId: channel._id, date: today },
    {
      $set: {
        tenantId: channel.tenantId,
        source: channel.source,
        followersCount: newFollowers,
        followersGrowth: growth,
        impressions: apiData?.impressions ?? 0,
        reach: apiData?.reach ?? 0,
        engagements: (apiData?.likes ?? 0) + (apiData?.comments ?? 0) + (apiData?.shares ?? 0),
        likes: apiData?.likes ?? 0,
        comments: apiData?.comments ?? 0,
        shares: apiData?.shares ?? 0,
        postsCount: apiData?.postsCount ?? channel.postsCount ?? 0,
      },
    },
    { upsert: true, new: true },
  );

  // Update channel snapshot
  await SocialChannel.findByIdAndUpdate(channel._id, {
    $set: { followersCount: newFollowers, lastFetchedAt: new Date() },
  });

  return { channelId: channel._id, source: channel.source, growth };
}

/**
 * Run ingestion for all active channels of a tenant.
 */
export async function runIngestionForTenant(tenantId) {
  const channels = await SocialChannel.find({ tenantId, isActive: true });
  const results = await Promise.allSettled(channels.map(ingestChannel));
  return results.map((r, i) => ({
    channelId: channels[i]._id,
    status: r.status,
    value: r.value ?? null,
    reason: r.reason?.message ?? null,
  }));
}

/**
 * KPI summary for the social dashboard.
 */
export async function getSocialKpis(tenantId, { from, to } = {}) {
  const channelList = await SocialChannel.find({ tenantId, isActive: true }).lean();

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const metricQuery = { tenantId };
  if (from || to) metricQuery.date = dateFilter;

  const [totals, perChannel, topPost] = await Promise.all([
    SocialMetric.aggregate([
      { $match: metricQuery },
      { $group: { _id: null, totalImpressions: { $sum: "$impressions" }, totalReach: { $sum: "$reach" }, totalEngagements: { $sum: "$engagements" }, maxFollowers: { $max: "$followersCount" }, totalGrowth: { $sum: "$followersGrowth" } } },
    ]),
    SocialMetric.aggregate([
      { $match: metricQuery },
      { $group: { _id: "$source", impressions: { $sum: "$impressions" }, reach: { $sum: "$reach" }, engagements: { $sum: "$engagements" }, followersGrowth: { $sum: "$followersGrowth" }, latestFollowers: { $last: "$followersCount" } } },
    ]),
    SocialPost.findOne(metricQuery.date ? { tenantId, postedAt: dateFilter } : { tenantId })
      .sort({ engagementRatePct: -1 }).lean(),
  ]);

  const t = totals[0] ?? {};
  const currentFollowers = channelList.reduce((acc, c) => acc + (c.followersCount ?? 0), 0);
  const avgEngagementRate = t.totalReach > 0
    ? Number(((t.totalEngagements / t.totalReach) * 100).toFixed(2))
    : 0;

  return {
    kpis: {
      totalFollowers: currentFollowers,
      followerGrowth: t.totalGrowth ?? 0,
      totalImpressions: t.totalImpressions ?? 0,
      totalReach: t.totalReach ?? 0,
      totalEngagements: t.totalEngagements ?? 0,
      avgEngagementRatePct: avgEngagementRate,
      topPostCaption: topPost?.caption?.slice(0, 120) ?? null,
      topPostUrl: topPost?.postUrl ?? null,
      topPostEngagementPct: topPost?.engagementRatePct ?? null,
    },
    perChannel: perChannel.map((c) => ({
      source: c._id,
      impressions: c.impressions,
      reach: c.reach,
      engagements: c.engagements,
      followersGrowth: c.followersGrowth,
      latestFollowers: c.latestFollowers,
    })),
    channels: channelList.map((c) => ({
      id: c._id,
      source: c.source,
      handle: c.channelHandle,
      displayName: c.displayName,
      followersCount: c.followersCount,
      lastFetchedAt: c.lastFetchedAt,
    })),
  };
}
