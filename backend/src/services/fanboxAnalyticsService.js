import { FanProfile } from "../models/FanProfile.js";
import { Sale } from "../models/Sale.js";
import { Ticket } from "../models/Ticket.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { CampaignParticipation } from "../models/CampaignParticipation.js";
import { FanMembership } from "../models/FanMembership.js";
import { MembershipTransaction } from "../models/MembershipTransaction.js";
import { LoyaltyLedgerEntry } from "../models/LoyaltyLedgerEntry.js";
import { resolvePeriod } from "./periodService.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function withDateRange(base, field, { from, to } = {}) {
  if (!from && !to) return base;
  const next = { ...base };
  next[field] = {};
  if (from) next[field].$gte = new Date(from);
  if (to) next[field].$lte = new Date(to);
  return next;
}

/** Build a query for the previous equivalent period (for delta calculations). */
function previousRange({ from, to }) {
  if (!from || !to) return null;
  const f = new Date(from);
  const t = new Date(to);
  const span = t - f;
  return {
    from: new Date(f - span).toISOString(),
    to: new Date(t - span).toISOString(),
  };
}

/** Compute period delta % between current and previous count. */
function pctDelta(current, prev) {
  if (!prev) return null;
  if (prev === 0) return current > 0 ? 100 : 0;
  return Number((((current - prev) / prev) * 100).toFixed(2));
}

// ─── Fan counters (WS1.10 — now date-filterable) ─────────────────────────────
export async function getFanCounters(tenantId, { from, to } = {}) {
  const base = { tenantId, status: "active" };
  const dateFilter = from || to ? withDateRange({}, "createdAt", { from, to }) : {};
  const q = { ...base, ...dateFilter };

  const [totalFans, withCpf, withForeigners, withEmail, withPhone, withAddress, withoutCpfNotForeigner] =
    await Promise.all([
      FanProfile.countDocuments(q),
      FanProfile.countDocuments({ ...q, cpf: { $exists: true, $nin: [null, ""] } }),
      FanProfile.countDocuments({ ...q, isForeigner: true }),
      FanProfile.countDocuments({ ...q, email: { $exists: true, $nin: [null, ""] } }),
      FanProfile.countDocuments({ ...q, phone: { $exists: true, $nin: [null, ""] } }),
      FanProfile.countDocuments({ ...q, "address.street": { $exists: true, $nin: [null, ""] }, "address.city": { $exists: true, $nin: [null, ""] } }),
      FanProfile.countDocuments({ ...q, cpf: { $in: [null, ""] }, isForeigner: { $ne: true } }),
    ]);

  return { totalFans, withCpf, withForeigners, withEmail, withPhone, withAddress, withoutCpfNotForeigner };
}

// ─── Fan growth (existing, preserved) ────────────────────────────────────────
export async function getFanGrowth(tenantId, { from, to, granularity = "month" } = {}) {
  const match = { tenantId, status: "active" };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const dateFormat =
    granularity === "month" ? "%Y-%m"
    : granularity === "week" ? "%Y-W%V"
    : granularity === "quarter" ? { $concat: [{ $toString: { $year: "$createdAt" } }, "-Q", { $toString: { $ceil: { $divide: [{ $month: "$createdAt" }, 3] } } }] }
    : granularity === "year" ? "%Y"
    : "%Y-%m-%d";

  const buckets = await FanProfile.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: dateFormat, date: "$createdAt" } }, newRegistrations: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  let cumulative = 0;
  const series = buckets.map((b) => {
    cumulative += b.newRegistrations;
    return { date: b._id, newRegistrations: b.newRegistrations, cumulativeTotal: cumulative };
  });

  return { granularity, series };
}

// ─── Engagement reports (WS1.3, WS1.7, WS1.8 — previousPeriod delta) ────────
export async function getEngagementReports(tenantId, { from, to } = {}) {
  const range = { from, to };
  const prev = previousRange(range);

  const attendanceQuery = withDateRange({ tenantId }, "recordedAt", range);
  const participationQuery = withDateRange({ tenantId }, "participatedAt", range);
  const ticketQuery = withDateRange({ tenantId }, "issuedAt", range);

  const [attendanceTotal, attendanceByStatus, ticketTotals, campaignParticipationTotal, uniqueFans,
    prevAttendance, prevTickets] = await Promise.all([
    AttendanceRecord.countDocuments(attendanceQuery),
    AttendanceRecord.aggregate([
      { $match: attendanceQuery },
      { $group: { _id: "$attendanceStatus", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Ticket.aggregate([
      { $match: ticketQuery },
      { $group: { _id: null, issued: { $sum: 1 }, used: { $sum: { $cond: [{ $eq: ["$status", "used"] }, 1, 0] } }, revenueCents: { $sum: "$priceCents" } } },
    ]),
    CampaignParticipation.countDocuments(participationQuery),
    AttendanceRecord.distinct("fanProfileId", attendanceQuery),
    // previous period
    prev ? AttendanceRecord.countDocuments(withDateRange({ tenantId }, "recordedAt", prev)) : Promise.resolve(null),
    prev ? Ticket.aggregate([
      { $match: withDateRange({ tenantId }, "issuedAt", prev) },
      { $group: { _id: null, issued: { $sum: 1 }, used: { $sum: { $cond: [{ $eq: ["$status", "used"] }, 1, 0] } } } },
    ]) : Promise.resolve(null),
  ]);

  const stats = ticketTotals[0] ?? { issued: 0, used: 0, revenueCents: 0 };
  const prevStats = prevTickets?.[0] ?? null;
  const ticketUseRatePct = stats.issued ? Number(((stats.used / stats.issued) * 100).toFixed(2)) : 0;
  const soldNotCheckedIn = stats.issued - stats.used;
  const avgTicketValueCents = stats.issued ? Math.round(stats.revenueCents / stats.issued) : 0;

  return {
    from: from ?? null,
    to: to ?? null,
    kpis: {
      attendanceTotal,
      uniqueAttendees: uniqueFans.length,
      campaignParticipationTotal,
      ticketIssued: stats.issued,
      ticketUsed: stats.used,
      ticketUseRatePct,
      soldNotCheckedIn,          // WS1.7 — first-class KPI
      avgTicketValueCents,        // WS1.3
    },
    previousPeriod: prev ? {
      attendanceTotal: prevAttendance,
      attendanceDeltaPct: pctDelta(attendanceTotal, prevAttendance),
      ticketIssued: prevStats?.issued ?? 0,
      ticketIssuedDeltaPct: pctDelta(stats.issued, prevStats?.issued ?? 0),
    } : null,
    attendanceByStatus: attendanceByStatus.map((r) => ({ status: r._id, count: r.count })),
  };
}

// ─── Spend reports (WS1.8 — previousPeriod) ──────────────────────────────────
export async function getSpendReports(tenantId, { from, to } = {}) {
  const range = { from, to };
  const prev = previousRange(range);

  const salesQuery = withDateRange({ tenantId, status: "completed", paymentStatus: { $in: ["paid", "refunded"] } }, "createdAt", range);
  const membershipQuery = withDateRange({ tenantId, status: "completed" }, "createdAt", range);

  const [saleStats, salesByChannel, membershipStats, prevSaleStats] = await Promise.all([
    Sale.aggregate([
      { $match: salesQuery },
      { $group: { _id: null, totalSalesCents: { $sum: "$totalCents" }, orders: { $sum: 1 }, uniqueFans: { $addToSet: "$fanProfileId" } } },
    ]),
    Sale.aggregate([
      { $match: salesQuery },
      { $group: { _id: "$channel", totalCents: { $sum: "$totalCents" }, orders: { $sum: 1 } } },
      { $sort: { totalCents: -1 } },
    ]),
    MembershipTransaction.aggregate([
      { $match: membershipQuery },
      { $group: { _id: null, totalMembershipCents: { $sum: "$amountCents" }, transactions: { $sum: 1 } } },
    ]),
    prev ? Sale.aggregate([
      { $match: withDateRange({ tenantId, status: "completed", paymentStatus: { $in: ["paid", "refunded"] } }, "createdAt", prev) },
      { $group: { _id: null, totalSalesCents: { $sum: "$totalCents" }, orders: { $sum: 1 } } },
    ]) : Promise.resolve(null),
  ]);

  const saleTotals = saleStats[0] ?? { totalSalesCents: 0, orders: 0, uniqueFans: [] };
  const membershipTotals = membershipStats[0] ?? { totalMembershipCents: 0, transactions: 0 };
  const prevSale = prevSaleStats?.[0] ?? null;
  const avgOrderValueCents = saleTotals.orders ? Math.round(saleTotals.totalSalesCents / saleTotals.orders) : 0;

  return {
    from: from ?? null,
    to: to ?? null,
    kpis: {
      totalSalesCents: saleTotals.totalSalesCents,
      salesOrders: saleTotals.orders,
      uniqueBuyingFans: saleTotals.uniqueFans.filter(Boolean).length,
      avgOrderValueCents,
      totalMembershipCents: membershipTotals.totalMembershipCents,
      membershipTransactions: membershipTotals.transactions,
      totalCombinedRevenueCents: saleTotals.totalSalesCents + membershipTotals.totalMembershipCents,
    },
    previousPeriod: prev ? {
      totalSalesCents: prevSale?.totalSalesCents ?? 0,
      salesOrders: prevSale?.orders ?? 0,
      revenueDeltaPct: pctDelta(saleTotals.totalSalesCents, prevSale?.totalSalesCents ?? 0),
      ordersDeltaPct: pctDelta(saleTotals.orders, prevSale?.orders ?? 0),
    } : null,
    byChannel: salesByChannel.map((r) => ({ channel: r._id, totalCents: r.totalCents, orders: r.orders })),
  };
}

// ─── Fan demographics (WS1.10 — now date-filterable) ─────────────────────────
async function aggregateFanDemographic(tenantId, field, dateFilter = {}) {
  const match = { tenantId, status: "active", ...dateFilter };
  const groups = await FanProfile.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);
  return groups.map((r) => ({ value: r._id ?? "unknown", count: r.count }));
}

export async function getFanDemographics(tenantId, { from, to } = {}) {
  const dateFilter = from || to ? withDateRange({}, "createdAt", { from, to }) : {};
  const [byCity, byState, byGender, byAgeBand, hasChildren, incomeBand] = await Promise.all([
    aggregateFanDemographic(tenantId, "address.city", dateFilter),
    aggregateFanDemographic(tenantId, "address.state", dateFilter),
    aggregateFanDemographic(tenantId, "gender", dateFilter),
    aggregateFanDemographic(tenantId, "ageRange", dateFilter),
    aggregateFanDemographic(tenantId, "hasChildren", dateFilter),
    aggregateFanDemographic(tenantId, "householdIncomeBand", dateFilter),
  ]);
  return { byCity, byState, byGender, byAgeBand, hasChildren, incomeBand };
}

// ─── Business reports — expanded (WS1.1 through WS1.9) ───────────────────────
export async function getBusinessReport(tenantId, source, { from, to } = {}) {
  const range = { from, to };
  const prev = previousRange(range);

  // ── Membership (WS1.2) ────────────────────────────────────────────────────
  if (source === "membership") {
    const txQuery = withDateRange({ tenantId, status: "completed" }, "createdAt", range);
    const [activeMemberships, newMemberships, cancelledMemberships, membershipRevenue,
      allActiveForArpu, prevTx] = await Promise.all([
      FanMembership.countDocuments({ tenantId, status: "active" }),
      FanMembership.countDocuments(withDateRange({ tenantId }, "createdAt", range)),
      FanMembership.countDocuments(withDateRange({ tenantId, status: { $in: ["cancelled", "expired"] } }, "updatedAt", range)),
      MembershipTransaction.aggregate([
        { $match: txQuery },
        { $group: { _id: null, revenueCents: { $sum: "$amountCents" }, count: { $sum: 1 } } },
      ]),
      FanMembership.countDocuments({ tenantId, status: "active" }),
      prev ? MembershipTransaction.aggregate([
        { $match: withDateRange({ tenantId, status: "completed" }, "createdAt", prev) },
        { $group: { _id: null, revenueCents: { $sum: "$amountCents" } } },
      ]) : Promise.resolve(null),
    ]);

    const totals = membershipRevenue[0] ?? { revenueCents: 0, count: 0 };
    const netGrowth = newMemberships - cancelledMemberships;
    const arpuCents = allActiveForArpu > 0 ? Math.round(totals.revenueCents / allActiveForArpu) : 0;
    const prevRevenue = prev?.revenueCents ?? prevTx?.[0]?.revenueCents ?? 0;

    return {
      source,
      kpis: [
        { key: "active_memberships", label: "Active Memberships", value: activeMemberships },
        { key: "new_memberships", label: "New Memberships", value: newMemberships },
        { key: "churned_memberships", label: "Churned", value: cancelledMemberships },
        { key: "net_member_growth", label: "Net Growth", value: netGrowth },
        { key: "membership_revenue_cents", label: "Revenue", value: totals.revenueCents },
        { key: "membership_transactions", label: "Transactions", value: totals.count },
        { key: "membership_arpu_cents", label: "ARPU", value: arpuCents },
      ],
      previousPeriod: prev ? {
        revenueCents: prevRevenue,
        revenueDeltaPct: pctDelta(totals.revenueCents, prevRevenue),
      } : null,
    };
  }

  // ── Tickets (WS1.3, WS1.4, WS1.5) ────────────────────────────────────────
  if (source === "tickets") {
    const ticketQuery = withDateRange({ tenantId }, "issuedAt", range);
    const [totals, usedCount, memberBuyers, allBuyers, prevTotals] = await Promise.all([
      Ticket.aggregate([
        { $match: ticketQuery },
        { $group: { _id: null, issued: { $sum: 1 }, revenueCents: { $sum: "$priceCents" } } },
      ]),
      Ticket.countDocuments(withDateRange({ tenantId, status: "used" }, "usedAt", range)),
      Ticket.distinct("fanProfileId", ticketQuery),
      Ticket.distinct("fanProfileId", ticketQuery),
      prev ? Ticket.aggregate([
        { $match: withDateRange({ tenantId }, "issuedAt", prev) },
        { $group: { _id: null, issued: { $sum: 1 }, revenueCents: { $sum: "$priceCents" } } },
      ]) : Promise.resolve(null),
    ]);

    const stats = totals[0] ?? { issued: 0, revenueCents: 0 };
    const prevStats = prevTotals?.[0] ?? null;
    const soldNotCheckedIn = stats.issued - usedCount;
    const avgTicketValueCents = stats.issued ? Math.round(stats.revenueCents / stats.issued) : 0;
    const ticketUseRatePct = stats.issued ? Number(((usedCount / stats.issued) * 100).toFixed(2)) : 0;

    return {
      source,
      kpis: [
        { key: "tickets_issued", label: "Tickets Issued", value: stats.issued },
        { key: "tickets_used", label: "Tickets Used", value: usedCount },
        { key: "sold_not_checked_in", label: "Sold but Not Attended", value: soldNotCheckedIn },
        { key: "ticket_revenue_cents", label: "Ticket Revenue", value: stats.revenueCents },
        { key: "avg_ticket_value_cents", label: "Avg Ticket Value", value: avgTicketValueCents },
        { key: "ticket_use_rate_pct", label: "Use Rate %", value: ticketUseRatePct },
        { key: "unique_ticket_buyers", label: "Unique Buyers", value: allBuyers.length },
      ],
      previousPeriod: prev ? {
        ticketsIssued: prevStats?.issued ?? 0,
        revenueCents: prevStats?.revenueCents ?? 0,
        issuedDeltaPct: pctDelta(stats.issued, prevStats?.issued ?? 0),
        revenueDeltaPct: pctDelta(stats.revenueCents, prevStats?.revenueCents ?? 0),
      } : null,
    };
  }

  // ── Access (WS1.4, WS1.5) ─────────────────────────────────────────────────
  if (source === "access") {
    const query = withDateRange({ tenantId }, "recordedAt", range);
    const [total, statusGroups, uniqueFanIds, prevTotal] = await Promise.all([
      AttendanceRecord.countDocuments(query),
      AttendanceRecord.aggregate([
        { $match: query },
        { $group: { _id: "$attendanceStatus", count: { $sum: 1 } } },
      ]),
      AttendanceRecord.distinct("fanProfileId", query),
      prev ? AttendanceRecord.countDocuments(withDateRange({ tenantId }, "recordedAt", prev)) : Promise.resolve(null),
    ]);

    // Member vs non-member attendees — join via FanMembership
    const memberFanIds = await FanMembership.distinct("fanProfileId", { tenantId, status: "active" });
    const memberSet = new Set(memberFanIds.map(String));
    const memberAttendees = uniqueFanIds.filter((id) => memberSet.has(String(id))).length;
    const nonMemberAttendees = uniqueFanIds.length - memberAttendees;
    const memberAttendeePct = uniqueFanIds.length
      ? Number(((memberAttendees / uniqueFanIds.length) * 100).toFixed(2))
      : 0;

    // Issued tickets in period — for no-show rate
    const issuedInPeriod = await Ticket.countDocuments(withDateRange({ tenantId }, "issuedAt", range));
    const noShowRatePct = issuedInPeriod
      ? Number((((issuedInPeriod - total) / issuedInPeriod) * 100).toFixed(2))
      : 0;

    return {
      source,
      kpis: [
        { key: "access_records", label: "Total Gate Entries", value: total },
        { key: "unique_attendees", label: "Unique Attendees", value: uniqueFanIds.length },
        { key: "member_attendees", label: "Member Attendees", value: memberAttendees },
        { key: "non_member_attendees", label: "Non-Member Attendees", value: nonMemberAttendees },
        { key: "member_attendees_pct", label: "Member %", value: memberAttendeePct },
        { key: "no_show_rate_pct", label: "No-Show Rate %", value: noShowRatePct },
        ...statusGroups.map((r) => ({ key: `access_${r._id}`, label: r._id, value: r.count })),
      ],
      previousPeriod: prev ? {
        total: prevTotal,
        deltaPct: pctDelta(total, prevTotal),
      } : null,
    };
  }

  // ── Stores / E-Commerce / Coxa Foods (WS1.9 — bestLocation, top5) ─────────
  if (source === "stores" || source === "ecommerce" || source === "coxa-foods") {
    const channelMap = { stores: "pos", ecommerce: "fan_shop", "coxa-foods": "pos" };
    const baseQ = { tenantId, status: "completed", channel: channelMap[source] };
    const salesQuery = withDateRange(baseQ, "createdAt", range);

    const [totals, byLocation, prevTotals] = await Promise.all([
      Sale.aggregate([
        { $match: salesQuery },
        { $group: { _id: null, orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" }, uniqueFans: { $addToSet: "$fanProfileId" } } },
      ]),
      Sale.aggregate([
        { $match: salesQuery },
        { $group: { _id: "$locationId", orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" } } },
        { $sort: { revenueCents: -1 } },
        { $limit: 10 },
        { $lookup: { from: "locations", localField: "_id", foreignField: "_id", as: "loc" } },
        { $unwind: { path: "$loc", preserveNullAndEmptyArrays: true } },
      ]),
      prev ? Sale.aggregate([
        { $match: withDateRange(baseQ, "createdAt", prev) },
        { $group: { _id: null, orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" } } },
      ]) : Promise.resolve(null),
    ]);

    const stats = totals[0] ?? { orders: 0, revenueCents: 0, uniqueFans: [] };
    const prevStats = prevTotals?.[0] ?? null;
    const avgOrderValueCents = stats.orders ? Math.round(stats.revenueCents / stats.orders) : 0;

    const locRanked = byLocation.map((l) => ({
      locationId: l._id,
      locationName: l.loc?.name ?? l._id,
      orders: l.orders,
      revenueCents: l.revenueCents,
    }));

    const kpis = [
      { key: `${source}_orders`, label: "Orders", value: stats.orders },
      { key: `${source}_revenue_cents`, label: "Revenue", value: stats.revenueCents },
      { key: `${source}_unique_buyers`, label: "Unique Buyers", value: stats.uniqueFans.filter(Boolean).length },
      { key: `${source}_avg_order_value_cents`, label: "Avg Order Value", value: avgOrderValueCents },
    ];
    if (locRanked.length > 0) {
      kpis.push({ key: "best_location", label: "Best Location", value: locRanked[0]?.locationName });
      kpis.push({ key: "worst_location", label: "Worst Location", value: locRanked[locRanked.length - 1]?.locationName });
    }

    return {
      source,
      kpis,
      locationBreakdown: locRanked,
      top5Locations: locRanked.slice(0, 5),
      previousPeriod: prev ? {
        orders: prevStats?.orders ?? 0,
        revenueCents: prevStats?.revenueCents ?? 0,
        revenueDeltaPct: pctDelta(stats.revenueCents, prevStats?.revenueCents ?? 0),
        ordersDeltaPct: pctDelta(stats.orders, prevStats?.orders ?? 0),
      } : null,
    };
  }

  // ── Loyalty (WS1.6) ───────────────────────────────────────────────────────
  if (source === "loyalty") {
    const earnQuery = withDateRange({ tenantId, entryType: "earn" }, "createdAt", range);
    const redeemQuery = withDateRange({ tenantId, entryType: "redeem" }, "createdAt", range);

    const [earned, redeemed, prevEarned] = await Promise.all([
      LoyaltyLedgerEntry.aggregate([
        { $match: earnQuery },
        { $group: { _id: null, points: { $sum: "$pointsDelta" }, count: { $sum: 1 } } },
      ]),
      LoyaltyLedgerEntry.aggregate([
        { $match: redeemQuery },
        { $group: { _id: null, points: { $sum: { $abs: "$pointsDelta" } }, count: { $sum: 1 } } },
      ]),
      prev ? LoyaltyLedgerEntry.aggregate([
        { $match: withDateRange({ tenantId, entryType: "earn" }, "createdAt", prev) },
        { $group: { _id: null, points: { $sum: "$pointsDelta" } } },
      ]) : Promise.resolve(null),
    ]);

    const earnTotals = earned[0] ?? { points: 0, count: 0 };
    const redeemTotals = redeemed[0] ?? { points: 0, count: 0 };
    const redemptionRatePct = earnTotals.points
      ? Number(((redeemTotals.points / earnTotals.points) * 100).toFixed(2))
      : 0;

    return {
      source,
      kpis: [
        { key: "loyalty_points_issued", label: "Points Issued", value: earnTotals.points },
        { key: "loyalty_transactions", label: "Earn Transactions", value: earnTotals.count },
        { key: "loyalty_points_redeemed", label: "Points Redeemed", value: redeemTotals.points },
        { key: "loyalty_redemption_rate_pct", label: "Redemption Rate %", value: redemptionRatePct },
      ],
      previousPeriod: prev ? {
        pointsIssued: prevEarned?.[0]?.points ?? 0,
        deltaPct: pctDelta(earnTotals.points, prevEarned?.[0]?.points ?? 0),
      } : null,
    };
  }

  // ── Stub tabs (app, ott, coxa-run, manto) ────────────────────────────────
  if (["app", "ott", "coxa-run", "manto"].includes(source)) {
    return {
      source,
      kpis: [
        { key: "active_users", label: "Active Users", value: 0 },
        { key: "events", label: "Events", value: 0 },
        { key: "conversions", label: "Conversions", value: 0 },
      ],
      stub: true,
    };
  }

  const err = new Error("Business source not supported");
  err.status = 400;
  err.code = "INVALID_BUSINESS_SOURCE";
  throw err;
}
