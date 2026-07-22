import { CheckInWindow } from "../models/CheckInWindow.js";
import { FanScore } from "../models/FanScore.js";
import { FanMembership } from "../models/FanMembership.js";
import { FanProfile } from "../models/FanProfile.js";
import { MembershipPlan } from "../models/MembershipPlan.js";

/**
 * Returns the check-in windows a fan is eligible for on a given match.
 *
 * Eligibility rules:
 *   1. Fan must have an active FanMembership.
 *   2. Window.fanScoreMin <= fan's totalScore.
 *   3. Window must not be closed and must have remaining capacity.
 */
export async function getAvailableWindowsForFan(tenantId, fanProfileId, matchEventId) {
  const [membership, fanScore] = await Promise.all([
    FanMembership.findOne({ tenantId, fanProfileId, status: "active" }),
    FanScore.findOne({ tenantId, fanProfileId }),
  ]);

  if (!membership) return [];

  const score = fanScore?.totalScore ?? 0;

  const windows = await CheckInWindow.find({
    tenantId,
    matchEventId,
    status: { $in: ["scheduled", "open"] },
  })
    .sort({ fanScoreMin: -1, opensAt: 1 })
    .populate("membershipPlanId", "name planCode tierLevel priorityBase");

  return windows.filter((w) => {
    const available = w.checkedInCount < w.capacity;
    const scoreOk = score >= (w.fanScoreMin ?? 0);
    return available && scoreOk;
  });
}

/**
 * Admin: open windows for a match sorted by fanScoreMin (highest first = diamond fans first).
 * Returns a summary of which windows are open/scheduled and how many fans qualify.
 */
export async function openWindowsForMatch(tenantId, matchEventId) {
  const windows = await CheckInWindow.find({ tenantId, matchEventId })
    .sort({ fanScoreMin: -1 })
    .populate("membershipPlanId", "name planCode");

  const now = new Date();
  const results = [];

  for (const win of windows) {
    if (now >= win.opensAt && now <= win.closesAt && win.status !== "open") {
      win.status = "open";
      await win.save();
    } else if (now > win.closesAt && win.status !== "closed") {
      win.status = "closed";
      await win.save();
    }
    results.push({
      windowId: win._id,
      name: win.name,
      status: win.status,
      fanScoreMin: win.fanScoreMin,
      capacity: win.capacity,
      checkedInCount: win.checkedInCount,
      opensAt: win.opensAt,
      closesAt: win.closesAt,
    });
  }

  return results;
}

/**
 * Admin: returns fans ranked by score for a given match (priority list).
 * Only fans whose score qualifies for at least one window of this match are included.
 */
export async function getPriorityRanking(tenantId, matchEventId, limit = 100) {
  // Find the minimum score threshold across all windows for this match
  const windows = await CheckInWindow.find({ tenantId, matchEventId }).sort({ fanScoreMin: 1 });
  const lowestThreshold = windows.length > 0 ? (windows[0].fanScoreMin ?? 0) : 0;

  // Only rank fans with active memberships who can access at least the lowest window
  const memberships = await FanMembership.find({ tenantId, status: "active" })
    .populate("planId", "name planCode priorityBase tierLevel");

  if (memberships.length === 0) return [];

  const fanProfileIds = memberships.map((m) => m.fanProfileId);

  const scores = await FanScore.find({
    tenantId,
    fanProfileId: { $in: fanProfileIds },
    totalScore: { $gte: lowestThreshold },
  })
    .sort({ totalScore: -1 })
    .limit(limit);

  const membershipMap = new Map(memberships.map((m) => [m.fanProfileId.toString(), m]));

  const fanIds = scores.map((s) => s.fanProfileId);
  const profiles = await FanProfile.find({ _id: { $in: fanIds }, tenantId });
  const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));

  return scores.map((s, idx) => {
    const fid = s.fanProfileId.toString();
    const profile = profileMap.get(fid);
    const membership = membershipMap.get(fid);
    // Determine the best window this fan qualifies for
    const bestWindow = [...windows].reverse().find((w) => s.totalScore >= (w.fanScoreMin ?? 0));
    return {
      rank: idx + 1,
      fanProfileId: fid,
      fullName: profile?.fullName,
      email: profile?.email,
      memberNumber: membership?.memberNumber,
      planCode: membership?.planCode,
      totalScore: s.totalScore,
      tier: s.tier,
      joinDate: membership?.joinDate,
      bestWindowName: bestWindow?.name ?? null,
    };
  });
}

/**
 * Returns windows a specific fan can check into right now (status=open + eligible).
 */
export async function getOpenWindowsForFan(tenantId, fanProfileId, matchEventId) {
  const all = await getAvailableWindowsForFan(tenantId, fanProfileId, matchEventId);
  return all.filter((w) => w.status === "open");
}
