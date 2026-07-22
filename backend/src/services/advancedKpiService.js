import { FanProfile } from "../models/FanProfile.js";
import { Sale } from "../models/Sale.js";
import { Ticket } from "../models/Ticket.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { FanMembership } from "../models/FanMembership.js";
import { MembershipTransaction } from "../models/MembershipTransaction.js";
import { LoyaltyLedgerEntry } from "../models/LoyaltyLedgerEntry.js";
import { CdpEvent } from "../models/CdpEvent.js";
import { SocialMetric, SocialPost } from "../models/Social.js";

function withRange(base, field, from, to) {
  if (!from && !to) return base;
  const q = { ...base };
  q[field] = {};
  if (from) q[field].$gte = new Date(from);
  if (to) q[field].$lte = new Date(to);
  return q;
}

function pctDelta(curr, prev) {
  if (prev == null || prev === 0) return curr > 0 ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(2));
}

function prevRange(from, to) {
  if (!from || !to) return {};
  const f = new Date(from), t = new Date(to);
  const span = t - f;
  return { from: new Date(f - span).toISOString(), to: new Date(t - span).toISOString() };
}

// ── Fan Intelligence ─────────────────────────────────────────────────────────

export async function getFanIntelligence(tenantId, { from, to } = {}) {
  const baseQ = { tenantId, status: "active" };
  const now = new Date();
  const d90 = new Date(now - 90 * 86400000);
  const d30 = new Date(now - 30 * 86400000);

  const [totalFans, withEmail, withPhone, withCpf, withAddress] = await Promise.all([
    FanProfile.countDocuments(baseQ),
    FanProfile.countDocuments({ ...baseQ, email: { $exists: true, $nin: [null, ""] } }),
    FanProfile.countDocuments({ ...baseQ, phone: { $exists: true, $nin: [null, ""] } }),
    FanProfile.countDocuments({ ...baseQ, cpf: { $exists: true, $nin: [null, ""] } }),
    FanProfile.countDocuments({ ...baseQ, "address.street": { $exists: true, $nin: [null, ""] } }),
  ]);

  const dataCompletenessPct = totalFans > 0
    ? Number(((withEmail + withPhone + withCpf + withAddress) / (totalFans * 4) * 100).toFixed(2))
    : 0;

  // Fans with NO activity in 90 days (no attendance, no ticket, no purchase)
  const activeAttendees90 = await AttendanceRecord.distinct("fanProfileId", { tenantId, recordedAt: { $gte: d90 } });
  const activeBuyers90 = await Sale.distinct("fanProfileId", { tenantId, status: "completed", createdAt: { $gte: d90 } });
  const activeSet = new Set([...activeAttendees90.map(String), ...activeBuyers90.map(String)]);

  const allFanIds = await FanProfile.distinct("_id", baseQ);
  const churnRiskCount = allFanIds.filter((id) => !activeSet.has(String(id))).length;

  // Cohort retention: fans registered in the period who had activity in 30d / 90d after registration
  let cohortRetention30 = null, cohortRetention90 = null;
  if (from && to) {
    const cohortFans = await FanProfile.find(
      withRange({ tenantId, status: "active" }, "createdAt", from, to),
      { _id: 1, createdAt: 1 }
    ).lean();

    if (cohortFans.length > 0) {
      let active30 = 0, active90 = 0;
      const cohortIds = cohortFans.map((f) => f._id);

      const [att30, att90, sale30, sale90] = await Promise.all([
        AttendanceRecord.distinct("fanProfileId", {
          tenantId, fanProfileId: { $in: cohortIds },
          recordedAt: { $gte: new Date(new Date(from) - 0), $lte: new Date(new Date(from).getTime() + 30 * 86400000) },
        }),
        AttendanceRecord.distinct("fanProfileId", {
          tenantId, fanProfileId: { $in: cohortIds },
          recordedAt: { $gte: new Date(from), $lte: new Date(new Date(from).getTime() + 90 * 86400000) },
        }),
        Sale.distinct("fanProfileId", {
          tenantId, fanProfileId: { $in: cohortIds }, status: "completed",
          createdAt: { $gte: new Date(from), $lte: new Date(new Date(from).getTime() + 30 * 86400000) },
        }),
        Sale.distinct("fanProfileId", {
          tenantId, fanProfileId: { $in: cohortIds }, status: "completed",
          createdAt: { $gte: new Date(from), $lte: new Date(new Date(from).getTime() + 90 * 86400000) },
        }),
      ]);

      const active30Set = new Set([...att30.map(String), ...sale30.map(String)]);
      const active90Set = new Set([...att90.map(String), ...sale90.map(String)]);
      active30 = cohortFans.filter((f) => active30Set.has(String(f._id))).length;
      active90 = cohortFans.filter((f) => active90Set.has(String(f._id))).length;

      cohortRetention30 = Number(((active30 / cohortFans.length) * 100).toFixed(2));
      cohortRetention90 = Number(((active90 / cohortFans.length) * 100).toFixed(2));
    }
  }

  return {
    dataCompletenessPct,
    churnRiskCount,
    cohortRetention30dPct: cohortRetention30,
    cohortRetention90dPct: cohortRetention90,
    totalFans,
  };
}

// ── Membership Advanced ───────────────────────────────────────────────────────

export async function getMembershipAdvanced(tenantId, { from, to } = {}) {
  const now = new Date();
  const d30 = new Date(now.getTime() + 30 * 86400000);

  const [activeCount, txStats, planMix, expiringCount, reactivated] = await Promise.all([
    FanMembership.countDocuments({ tenantId, status: "active" }),
    MembershipTransaction.aggregate([
      { $match: withRange({ tenantId, status: "completed" }, "createdAt", from, to) },
      { $group: { _id: null, revenue: { $sum: "$amountCents" }, count: { $sum: 1 } } },
    ]),
    FanMembership.aggregate([
      { $match: { tenantId, status: "active" } },
      { $group: { _id: "$planId", count: { $sum: 1 }, planName: { $first: "$planName" } } },
      { $sort: { count: -1 } },
    ]),
    FanMembership.countDocuments({
      tenantId, status: "active",
      expiresAt: { $gte: now, $lte: d30 },
    }),
    MembershipTransaction.aggregate([
      { $match: withRange({ tenantId, status: "completed", transactionType: "renewal" }, "createdAt", from, to) },
      { $group: { _id: null, revenue: { $sum: "$amountCents" }, count: { $sum: 1 } } },
    ]),
  ]);

  const txTotals = txStats[0] ?? { revenue: 0, count: 0 };
  const arpuCents = activeCount > 0 ? Math.round(txTotals.revenue / activeCount) : 0;
  const mrrCents = arpuCents; // ARPU already represents per-member per-period spend
  const arrCents = mrrCents * 12;
  const reactivationTotals = reactivated[0] ?? { revenue: 0, count: 0 };

  // Churn rate: get start-of-period active count
  const startCount = await FanMembership.countDocuments(
    withRange({ tenantId, status: { $in: ["active", "cancelled", "expired"] } }, "createdAt", null, from)
  );
  const churned = await FanMembership.countDocuments(
    withRange({ tenantId, status: { $in: ["cancelled", "expired"] } }, "updatedAt", from, to)
  );
  const churnRatePct = startCount > 0 ? Number(((churned / startCount) * 100).toFixed(2)) : 0;

  const totalForMix = planMix.reduce((s, p) => s + p.count, 0);
  const planMixData = planMix.map((p) => ({
    planId: p._id,
    planName: p.planName ?? String(p._id),
    count: p.count,
    pct: totalForMix > 0 ? Number(((p.count / totalForMix) * 100).toFixed(1)) : 0,
  }));

  return {
    mrrCents,
    arrCents,
    churnRatePct,
    membersAtRiskCount: expiringCount,
    revenueRecoveryCents: reactivationTotals.revenue,
    reactivatedCount: reactivationTotals.count,
    planMix: planMixData,
  };
}

// ── Revenue Intelligence ──────────────────────────────────────────────────────

export async function getRevenueIntelligence(tenantId, { from, to } = {}) {
  const salesQ  = withRange({ tenantId, status: "completed" }, "createdAt", from, to);
  const txQ     = withRange({ tenantId, status: "completed" }, "createdAt", from, to);
  const ticketQ = withRange({ tenantId }, "issuedAt", from, to);

  const pr = prevRange(from, to);
  const salesQPrev  = pr.from ? withRange({ tenantId, status: "completed" }, "createdAt", pr.from, pr.to) : null;

  const [saleAgg, txAgg, ticketAgg, attendeeIds, prevSaleAgg] = await Promise.all([
    Sale.aggregate([
      { $match: salesQ },
      { $group: {
        _id: "$channel",
        revenueCents: { $sum: "$totalCents" },
        orders: { $sum: 1 },
        uniqueFans: { $addToSet: "$fanProfileId" },
      }},
    ]),
    MembershipTransaction.aggregate([
      { $match: txQ },
      { $group: { _id: null, revenueCents: { $sum: "$amountCents" } } },
    ]),
    Ticket.aggregate([
      { $match: ticketQ },
      { $group: { _id: null, revenueCents: { $sum: "$priceCents" } } },
    ]),
    AttendanceRecord.distinct("fanProfileId", withRange({ tenantId }, "recordedAt", from, to)),
    salesQPrev ? Sale.aggregate([
      { $match: salesQPrev },
      { $group: { _id: null, revenueCents: { $sum: "$totalCents" } } },
    ]) : Promise.resolve(null),
  ]);

  const byChannel = {};
  let totalSalesCents = 0;
  const uniqueBuyerSets = {};
  for (const row of saleAgg) {
    byChannel[row._id ?? "other"] = row.revenueCents;
    totalSalesCents += row.revenueCents;
    uniqueBuyerSets[row._id] = row.uniqueFans;
  }
  const membershipRevCents = txAgg[0]?.revenueCents ?? 0;
  const ticketRevCents = ticketAgg[0]?.revenueCents ?? 0;
  const totalPlatformRevCents = totalSalesCents + membershipRevCents + ticketRevCents;

  const uniqueAttendees = attendeeIds.length;
  const allUniqueBuyers = new Set(Object.values(uniqueBuyerSets).flat().map(String));

  const revenuePerAttendeeCents = uniqueAttendees > 0
    ? Math.round(totalPlatformRevCents / uniqueAttendees) : 0;
  const activeMembers = await FanMembership.countDocuments({ tenantId, status: "active" });
  const revenuePerMemberCents = activeMembers > 0
    ? Math.round(totalPlatformRevCents / activeMembers) : 0;

  const prevRevCents = prevSaleAgg?.[0]?.revenueCents ?? 0;
  const revenueGrowthPct = pctDelta(totalPlatformRevCents, prevRevCents);

  const streamBreakdown = [
    { name: "Membership", value: membershipRevCents },
    { name: "Tickets", value: ticketRevCents },
    { name: "POS Retail", value: byChannel["pos"] ?? 0 },
    { name: "Online Shop", value: byChannel["fan_shop"] ?? 0 },
    { name: "F&B", value: byChannel["coxa-foods"] ?? 0 },
  ].filter((s) => s.value > 0);

  return {
    totalPlatformRevCents,
    revenuePerAttendeeCents,
    revenuePerMemberCents,
    revenueGrowthPct,
    streamBreakdown,
  };
}

// ── Ticket Advanced ───────────────────────────────────────────────────────────

export async function getTicketAdvanced(tenantId, { from, to } = {}) {
  const ticketQ = withRange({ tenantId }, "issuedAt", from, to);

  const [totals, usedCount, distinctMatches, memberFanIds, buyerIds] = await Promise.all([
    Ticket.aggregate([
      { $match: ticketQ },
      { $group: { _id: null, issued: { $sum: 1 }, revenueCents: { $sum: "$priceCents" } } },
    ]),
    Ticket.countDocuments(withRange({ tenantId, status: "used" }, "usedAt", from, to)),
    Ticket.distinct("matchId", ticketQ),
    FanMembership.distinct("fanProfileId", { tenantId, status: "active" }),
    Ticket.distinct("fanProfileId", ticketQ),
  ]);

  const stats = totals[0] ?? { issued: 0, revenueCents: 0 };
  const matchCount = distinctMatches.filter(Boolean).length || 1;

  const memberSet = new Set(memberFanIds.map(String));
  const memberBuyers = buyerIds.filter((id) => memberSet.has(String(id))).length;
  const memberTicketBuyersPct = buyerIds.length > 0
    ? Number(((memberBuyers / buyerIds.length) * 100).toFixed(2)) : 0;

  const avgTicketsPerMatch = Math.round(stats.issued / matchCount);
  const ticketRevenuePerMatchCents = Math.round(stats.revenueCents / matchCount);
  const sellThroughPct = null; // Requires capacity data — stub for now

  return {
    avgTicketsPerMatch,
    memberTicketBuyersPct,
    ticketRevenuePerMatchCents,
    sellThroughPct,
    matchCount,
  };
}

// ── Retail Advanced ───────────────────────────────────────────────────────────

export async function getRetailAdvanced(tenantId, { from, to } = {}) {
  const salesQ = withRange({ tenantId, status: "completed", channel: "pos" }, "createdAt", from, to);
  const attendeeIds = await AttendanceRecord.distinct("fanProfileId",
    withRange({ tenantId }, "recordedAt", from, to));

  const [summary, repeatBuyers, topCat] = await Promise.all([
    Sale.aggregate([
      { $match: salesQ },
      { $group: { _id: null, revenueCents: { $sum: "$totalCents" }, orders: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: salesQ },
      { $group: { _id: "$fanProfileId", orders: { $sum: 1 } } },
      { $match: { orders: { $gte: 2 }, _id: { $ne: null } } },
      { $count: "repeatBuyers" },
    ]),
    Sale.aggregate([
      { $match: salesQ },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.categoryId", rev: { $sum: "$lines.lineTotalCents" } } },
      { $sort: { rev: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const totals = summary[0] ?? { revenueCents: 0, orders: 0 };
  const totalBuyers = await Sale.distinct("fanProfileId", { ...salesQ, fanProfileId: { $ne: null } });
  const repeatCount = repeatBuyers[0]?.repeatBuyers ?? 0;
  const repeatBuyerRatePct = totalBuyers.length > 0
    ? Number(((repeatCount / totalBuyers.length) * 100).toFixed(2)) : 0;

  const retailRevPerAttendeeCents = attendeeIds.length > 0
    ? Math.round(totals.revenueCents / attendeeIds.length) : 0;

  // Category concentration — get total retail rev including all channels
  const allRetailQ = withRange({ tenantId, status: "completed" }, "createdAt", from, to);
  const catBreakdown = await Sale.aggregate([
    { $match: allRetailQ },
    { $unwind: "$lines" },
    { $group: { _id: "$lines.categoryId", rev: { $sum: "$lines.lineTotalCents" } } },
    { $sort: { rev: -1 } },
  ]);
  const totalCatRev = catBreakdown.reduce((s, c) => s + c.rev, 0);
  const topCatRev = catBreakdown[0]?.rev ?? 0;
  const categoryConcentrationPct = totalCatRev > 0
    ? Number(((topCatRev / totalCatRev) * 100).toFixed(2)) : 0;

  return {
    retailRevPerAttendeeCents,
    repeatBuyerRatePct,
    categoryConcentrationPct,
  };
}

// ── Loyalty Advanced ──────────────────────────────────────────────────────────

export async function getLoyaltyAdvanced(tenantId, { from, to } = {}) {
  const d90 = new Date(Date.now() - 90 * 86400000);
  const earnQ   = withRange({ tenantId, entryType: "earn" }, "createdAt", from, to);
  const redeemQ = withRange({ tenantId, entryType: "redeem" }, "createdAt", from, to);

  const [earned, redeemed, activeEarners, totalFans, dormantFans, tierBefore, tierAfter] = await Promise.all([
    LoyaltyLedgerEntry.aggregate([
      { $match: earnQ },
      { $group: { _id: null, points: { $sum: "$pointsDelta" } } },
    ]),
    LoyaltyLedgerEntry.aggregate([
      { $match: redeemQ },
      { $group: { _id: null, points: { $sum: { $abs: "$pointsDelta" } } } },
    ]),
    LoyaltyLedgerEntry.distinct("fanProfileId", earnQ),
    FanProfile.countDocuments({ tenantId, status: "active" }),
    LoyaltyLedgerEntry.aggregate([
      { $match: { tenantId } },
      { $group: { _id: "$fanProfileId", lastActivity: { $max: "$createdAt" }, balance: { $sum: "$pointsDelta" } } },
      { $match: { lastActivity: { $lt: d90 }, balance: { $gt: 0 } } },
      { $count: "dormant" },
    ]),
    CdpEvent.distinct("fanProfileId",
      withRange({ tenantId, eventName: "membership.upgraded" }, "eventTimestamp", null, from)),
    CdpEvent.distinct("fanProfileId",
      withRange({ tenantId, eventName: "membership.upgraded" }, "eventTimestamp", from, to)),
  ]);

  const totalEarned = earned[0]?.points ?? 0;
  const totalRedeemed = redeemed[0]?.points ?? 0;
  const activeEarnersPct = totalFans > 0
    ? Number(((activeEarners.length / totalFans) * 100).toFixed(2)) : 0;
  const dormantCount = dormantFans[0]?.dormant ?? 0;

  // Tier upgrade rate: fans who upgraded in period / total fans
  const upgradeCount = tierAfter.filter((id) => !tierBefore.map(String).includes(String(id))).length;
  const tierUpgradeRatePct = totalFans > 0
    ? Number(((upgradeCount / totalFans) * 100).toFixed(2)) : 0;

  // Points burn rate: redeemed / (total outstanding balance)
  const balanceAgg = await LoyaltyLedgerEntry.aggregate([
    { $match: { tenantId } },
    { $group: { _id: null, balance: { $sum: "$pointsDelta" } } },
  ]);
  const outstandingBalance = balanceAgg[0]?.balance ?? 0;
  const burnRatePct = outstandingBalance > 0
    ? Number(((totalRedeemed / outstandingBalance) * 100).toFixed(2)) : 0;

  return {
    activeEarnersPct,
    dormantCount,
    tierUpgradeRatePct,
    pointsBurnRatePct: burnRatePct,
  };
}

// ── Social Advanced ───────────────────────────────────────────────────────────

export async function getSocialAdvanced(tenantId, { from, to } = {}) {
  // SocialMetric schema: source, date, followersCount, impressions, reach, engagements
  // SocialPost schema: mediaType (video/reel/short/image/etc), postedAt, impressions
  const q = withRange({ tenantId }, "date", from, to);
  const postQ = withRange({ tenantId }, "postedAt", from, to);

  const [byPlatform, engagementTrend, postMix] = await Promise.all([
    SocialMetric.aggregate([
      { $match: q },
      { $group: {
        _id: "$source",
        followers: { $max: "$followersCount" },
        impressions: { $sum: "$impressions" },
        engagements: { $sum: "$engagements" },
      }},
      { $sort: { followers: -1 } },
    ]),
    SocialMetric.aggregate([
      { $match: q },
      { $group: {
        _id: { $dateToString: { format: "%Y-%W", date: "$date" } },
        engagements: { $sum: "$engagements" },
        reach: { $sum: "$reach" },
      }},
      { $sort: { _id: 1 } },
      { $project: {
        week: "$_id",
        engagementRate: {
          $cond: [
            { $gt: ["$reach", 0] },
            { $multiply: [{ $divide: ["$engagements", "$reach"] }, 100] },
            0,
          ],
        },
      }},
    ]),
    SocialPost.aggregate([
      { $match: postQ },
      { $group: { _id: "$mediaType", impressions: { $sum: "$impressions" } } },
      { $sort: { impressions: -1 } },
    ]),
  ]);

  const totalPostImpressions = postMix.reduce((s, c) => s + c.impressions, 0);
  const videoImpressions = postMix
    .filter((c) => ["video", "reel", "short"].includes(c._id))
    .reduce((s, c) => s + c.impressions, 0);
  const videoSharePct = totalPostImpressions > 0
    ? Number(((videoImpressions / totalPostImpressions) * 100).toFixed(2)) : 0;

  return {
    byPlatform: byPlatform.map((p) => ({
      platform: p._id,
      followers: p.followers,
      impressions: p.impressions,
      engagements: p.engagements,
    })),
    engagementTrend: engagementTrend.map((t) => ({
      week: t.week,
      engagementRatePct: Number((t.engagementRate ?? 0).toFixed(2)),
    })),
    videoSharePct,
  };
}

// ── Fan 360 Cross-Department Value ────────────────────────────────────────────

export async function getFan360(tenantId, { from, to } = {}) {
  const salesQ  = withRange({ tenantId, status: "completed" }, "createdAt", from, to);
  const txQ     = withRange({ tenantId, status: "completed" }, "createdAt", from, to);
  const ticketQ = withRange({ tenantId }, "issuedAt", from, to);

  const [saleByFan, txByFan, ticketByFan] = await Promise.all([
    Sale.aggregate([
      { $match: salesQ },
      { $group: { _id: "$fanProfileId", saleCents: { $sum: "$totalCents" } } },
    ]),
    MembershipTransaction.aggregate([
      { $match: txQ },
      { $group: { _id: "$fanProfileId", txCents: { $sum: "$amountCents" } } },
    ]),
    Ticket.aggregate([
      { $match: ticketQ },
      { $group: { _id: "$fanProfileId", ticketCents: { $sum: "$priceCents" } } },
    ]),
  ]);

  // Merge all into fan value map
  const fanMap = {};
  const touchpoints = {};
  for (const row of saleByFan) {
    if (!row._id) continue;
    const k = String(row._id);
    fanMap[k] = (fanMap[k] ?? 0) + row.saleCents;
    touchpoints[k] = (touchpoints[k] ?? new Set()).add("retail");
  }
  for (const row of txByFan) {
    if (!row._id) continue;
    const k = String(row._id);
    fanMap[k] = (fanMap[k] ?? 0) + row.txCents;
    touchpoints[k] = (touchpoints[k] ?? new Set()).add("membership");
  }
  for (const row of ticketByFan) {
    if (!row._id) continue;
    const k = String(row._id);
    fanMap[k] = (fanMap[k] ?? 0) + row.ticketCents;
    touchpoints[k] = (touchpoints[k] ?? new Set()).add("tickets");
  }

  const allValues = Object.values(fanMap);
  if (allValues.length === 0) {
    return { top10RevenueSharePct: 0, multiTouchpointFansPct: 0, avgFan360ValueCents: 0, topFansBreakdown: [] };
  }

  allValues.sort((a, b) => b - a);
  const totalRev = allValues.reduce((s, v) => s + v, 0);
  const top10Count = Math.max(1, Math.ceil(allValues.length * 0.1));
  const top10Rev = allValues.slice(0, top10Count).reduce((s, v) => s + v, 0);
  const top10RevenueSharePct = totalRev > 0
    ? Number(((top10Rev / totalRev) * 100).toFixed(2)) : 0;

  const multiTouchFans = Object.values(touchpoints).filter((s) => s.size >= 3).length;
  const multiTouchpointFansPct = Object.keys(touchpoints).length > 0
    ? Number(((multiTouchFans / Object.keys(touchpoints).length) * 100).toFixed(2)) : 0;

  const avgFan360ValueCents = Math.round(totalRev / allValues.length);

  // Top 10 fans for breakdown table
  const topFansBreakdown = Object.entries(fanMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([fanId, totalCents]) => ({
      fanId,
      totalCents,
      touchpointCount: touchpoints[fanId]?.size ?? 0,
    }));

  return {
    top10RevenueSharePct,
    multiTouchpointFansPct,
    avgFan360ValueCents,
    topFansBreakdown,
  };
}

// ── Unified advanced KPI bundle ───────────────────────────────────────────────

export async function getAllAdvancedKpis(tenantId, { from, to } = {}) {
  const [fan, membership, revenue, ticket, retail, loyalty, social, fan360] = await Promise.all([
    getFanIntelligence(tenantId, { from, to }),
    getMembershipAdvanced(tenantId, { from, to }),
    getRevenueIntelligence(tenantId, { from, to }),
    getTicketAdvanced(tenantId, { from, to }),
    getRetailAdvanced(tenantId, { from, to }),
    getLoyaltyAdvanced(tenantId, { from, to }),
    getSocialAdvanced(tenantId, { from, to }),
    getFan360(tenantId, { from, to }),
  ]);

  return { fan, membership, revenue, ticket, retail, loyalty, social, fan360 };
}

