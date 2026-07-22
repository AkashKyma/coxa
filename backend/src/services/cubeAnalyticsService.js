/**
 * Cube Analytics Service — Phase 2 KPI engine powered by ClickHouse via Cube.
 *
 * Strategy:
 *  1. Try to serve from Cube (ClickHouse, sub-second queries)
 *  2. Fall back to MongoDB aggregations if Cube is unavailable
 *
 * All functions in this file mirror the signatures in fanboxAnalyticsService.js
 * so callers can swap with a single import change.
 *
 * Routing is done by the exported wrapper functions at the bottom of this file.
 */

import { cubeQuery, cubeScalar, cubeBreakdown, cubeTimeSeries, isCubeEnabled } from "../lib/cubeClient.js";

// Mongo services are loaded lazily (dynamic import) so they are clearly
// fallback-only dependencies and never execute if Cube is healthy.
async function getFanboxMongoService() {
  return import("./fanboxAnalyticsService.js");
}
async function getAdvancedKpiService() {
  return import("./advancedKpiService.js");
}
async function getRetailMongoService() {
  return import("./retailAnalyticsService.js");
}

// ─── Helper: Cube date range format ──────────────────────────────────────────

function toDateRange({ from, to } = {}) {
  if (!from && !to) return null;
  const now = new Date().toISOString().split("T")[0];
  return {
    from: from ? new Date(from).toISOString().split("T")[0] : "2020-01-01",
    to: to ? new Date(to).toISOString().split("T")[0] : now,
  };
}

// ─── Fan Counters ─────────────────────────────────────────────────────────────

async function getFanCountersFromCube(tenantId, { from, to } = {}) {
  const dateRange = toDateRange({ from, to });

  const rows = await cubeQuery(
    {
      measures: [
        "Fans.totalFans",
        "Fans.withCpf",
        "Fans.withForeigners",
        "Fans.withEmail",
        "Fans.withPhone",
        "Fans.activeFans30d",
        "Fans.dataCompletenessPct",
        "Fans.fansAtChurnRisk",
      ],
      ...(dateRange && {
        timeDimensions: [
          { dimension: "Fans.registeredAt", dateRange: [dateRange.from, dateRange.to] },
        ],
      }),
    },
    tenantId
  );

  if (!rows || rows.length === 0) return null;
  const r = rows[0];

  return {
    totalFans: r["Fans.totalFans"] ?? 0,
    withCpf: r["Fans.withCpf"] ?? 0,
    withForeigners: r["Fans.withForeigners"] ?? 0,
    withEmail: r["Fans.withEmail"] ?? 0,
    withPhone: r["Fans.withPhone"] ?? 0,
    withoutCpfNotForeigner: (r["Fans.totalFans"] ?? 0) - (r["Fans.withCpf"] ?? 0) - (r["Fans.withForeigners"] ?? 0),
    activeFans30d: r["Fans.activeFans30d"] ?? 0,
    dataCompletenessPct: r["Fans.dataCompletenessPct"] ?? 0,
    fansAtChurnRisk: r["Fans.fansAtChurnRisk"] ?? 0,
    _source: "clickhouse",
  };
}

// ─── Engagement Reports ───────────────────────────────────────────────────────

async function getEngagementReportsFromCube(tenantId, { from, to } = {}) {
  const dateRange = toDateRange({ from, to });
  if (!dateRange) return null;

  const [ticketRows, eventRows] = await Promise.all([
    cubeQuery(
      {
        measures: [
          "Tickets.ticketsIssued",
          "Tickets.ticketsUsed",
          "Tickets.noShows",
          "Tickets.ticketRevenueCents",
          "Tickets.avgTicketValueCents",
          "Tickets.ticketUseRatePct",
          "Tickets.noShowRatePct",
        ],
        timeDimensions: [
          { dimension: "Tickets.weekStart", dateRange: [dateRange.from, dateRange.to] },
        ],
      },
      tenantId
    ),
    cubeQuery(
      {
        measures: ["CdpEvents.eventCount", "CdpEvents.uniqueFans"],
        filters: [{ member: "CdpEvents.eventName", operator: "equals", values: ["member.checked_in"] }],
        timeDimensions: [
          { dimension: "CdpEvents.eventTimestamp", dateRange: [dateRange.from, dateRange.to] },
        ],
      },
      tenantId
    ),
  ]);

  if (!ticketRows && !eventRows) return null;

  const t = ticketRows?.[0] ?? {};
  const e = eventRows?.[0] ?? {};

  return {
    from,
    to,
    kpis: {
      attendanceTotal: e["CdpEvents.eventCount"] ?? 0,
      uniqueAttendees: e["CdpEvents.uniqueFans"] ?? 0,
      campaignParticipationTotal: 0,
      ticketIssued: t["Tickets.ticketsIssued"] ?? 0,
      ticketUsed: t["Tickets.ticketsUsed"] ?? 0,
      ticketUseRatePct: t["Tickets.ticketUseRatePct"] ?? 0,
      soldNotCheckedIn: t["Tickets.noShows"] ?? 0,
      avgTicketValueCents: t["Tickets.avgTicketValueCents"] ?? 0,
    },
    previousPeriod: null,
    // attendanceByStatus is populated by Mongo fallback; Cube path returns empty
    // array so tables degrade gracefully rather than crashing on .map()
    attendanceByStatus: [],
    _source: "clickhouse",
  };
}

// ─── Spend Reports ─────────────────────────────────────────────────────────────

async function getSpendReportsFromCube(tenantId, { from, to } = {}) {
  const dateRange = toDateRange({ from, to });
  if (!dateRange) return null;

  const [salesRows, membershipRows, channelRows] = await Promise.all([
    cubeQuery(
      {
        measures: ["Sales.totalRevenueCents", "Sales.totalOrders", "Sales.avgOrderValueCents"],
        timeDimensions: [
          { dimension: "Sales.saleDate", dateRange: [dateRange.from, dateRange.to] },
        ],
      },
      tenantId
    ),
    cubeQuery(
      {
        measures: ["Memberships.totalRevenueCents", "Memberships.newMemberships"],
        timeDimensions: [
          { dimension: "Memberships.periodMonth", dateRange: [dateRange.from, dateRange.to] },
        ],
      },
      tenantId
    ),
    cubeQuery(
      {
        measures: ["Sales.totalRevenueCents", "Sales.totalOrders"],
        dimensions: ["Sales.channel"],
        timeDimensions: [
          { dimension: "Sales.saleDate", dateRange: [dateRange.from, dateRange.to] },
        ],
      },
      tenantId
    ),
  ]);

  if (!salesRows && !membershipRows) return null;

  const s = salesRows?.[0] ?? {};
  const m = membershipRows?.[0] ?? {};

  return {
    from,
    to,
    kpis: {
      totalSalesCents: s["Sales.totalRevenueCents"] ?? 0,
      salesOrders: s["Sales.totalOrders"] ?? 0,
      avgOrderValueCents: s["Sales.avgOrderValueCents"] ?? 0,
      totalMembershipCents: m["Memberships.totalRevenueCents"] ?? 0,
      membershipTransactions: m["Memberships.newMemberships"] ?? 0,
      totalRevenueCents: (s["Sales.totalRevenueCents"] ?? 0) + (m["Memberships.totalRevenueCents"] ?? 0),
    },
    // byChannel is the key the EngagementPage and OverviewPage expect
    byChannel: (channelRows ?? []).map((r) => ({
      channel: r["Sales.channel"],
      totalCents: r["Sales.totalRevenueCents"] ?? 0,
      orders: r["Sales.totalOrders"] ?? 0,
    })),
    previousPeriod: null,
    _source: "clickhouse",
  };
}

// ─── Member Reports ────────────────────────────────────────────────────────────

async function getMemberReportsFromCube(tenantId, { from, to } = {}) {
  const dateRange = toDateRange({ from, to });

  const [activeRows, lifecycleRows] = await Promise.all([
    cubeQuery(
      {
        measures: ["ActiveMemberships.activeMemberships"],
        dimensions: ["ActiveMemberships.planCode"],
      },
      tenantId
    ),
    cubeQuery(
      {
        measures: [
          "Memberships.newMemberships",
          "Memberships.churnedMemberships",
          "Memberships.renewedMemberships",
          "Memberships.upgradedMemberships",
          "Memberships.totalRevenueCents",
          "Memberships.netMemberGrowth",
        ],
        ...(dateRange && {
          timeDimensions: [
            { dimension: "Memberships.periodMonth", dateRange: [dateRange.from, dateRange.to] },
          ],
        }),
      },
      tenantId
    ),
  ]);

  if (!activeRows && !lifecycleRows) return null;

  const activeTotalByPlan = (activeRows ?? []).reduce((acc, r) => {
    acc[r["ActiveMemberships.planCode"]] = r["ActiveMemberships.activeMemberships"] ?? 0;
    return acc;
  }, {});
  const activeTotal = Object.values(activeTotalByPlan).reduce((s, v) => s + v, 0);
  const l = lifecycleRows?.[0] ?? {};

  return {
    from,
    to,
    kpis: {
      activeMemberships: activeTotal,
      newMemberships: l["Memberships.newMemberships"] ?? 0,
      churnedMemberships: l["Memberships.churnedMemberships"] ?? 0,
      renewedMemberships: l["Memberships.renewedMemberships"] ?? 0,
      upgradedMemberships: l["Memberships.upgradedMemberships"] ?? 0,
      membershipRevenueCents: l["Memberships.totalRevenueCents"] ?? 0,
      netMemberGrowth: l["Memberships.netMemberGrowth"] ?? 0,
    },
    planMix: Object.entries(activeTotalByPlan).map(([planCode, count]) => ({ planCode, count })),
    previousPeriod: null,
    _source: "clickhouse",
  };
}

// ─── Revenue Time Series ───────────────────────────────────────────────────────

async function getRevenueTrendFromCube(tenantId, { from, to, granularity = "month" } = {}) {
  const dateRange = toDateRange({ from, to });
  if (!dateRange) return null;

  const [salesSeries, streamBreakdown, membershipSeries] = await Promise.all([
    cubeTimeSeries("Revenue.totalRevenueCents", "Revenue.periodDate", granularity, tenantId, dateRange),
    cubeBreakdown("Revenue.totalRevenueCents", "Revenue.stream", tenantId, dateRange, "Revenue.periodDate"),
    cubeQuery(
      {
        measures: ["Memberships.totalRevenueCents"],
        timeDimensions: [
          { dimension: "Memberships.periodMonth", granularity, dateRange: [dateRange.from, dateRange.to] },
        ],
      },
      tenantId
    ),
  ]);

  if (!salesSeries) return null;

  return {
    granularity,
    series: (salesSeries ?? []).map((r) => ({
      date: r["Revenue.periodDate"],
      revenueCents: r["Revenue.totalRevenueCents"] ?? 0,
    })),
    membershipSeries: (membershipSeries ?? []).map((r) => ({
      date: r["Memberships.periodMonth"],
      revenueCents: r["Memberships.totalRevenueCents"] ?? 0,
    })),
    byStream: (streamBreakdown ?? []).reduce((acc, r) => {
      const stream = r["Revenue.stream"];
      if (!acc[stream]) acc[stream] = 0;
      acc[stream] += r["Revenue.totalRevenueCents"] ?? 0;
      return acc;
    }, {}),
    _source: "clickhouse",
  };
}

// ─── Loyalty Reports ──────────────────────────────────────────────────────────

async function getLoyaltyReportsFromCube(tenantId, { from, to } = {}) {
  const dateRange = toDateRange({ from, to });
  if (!dateRange) return null;

  const rows = await cubeQuery(
    {
      measures: [
        "Loyalty.pointsIssued",
        "Loyalty.pointsRedeemed",
        "Loyalty.redemptionRatePct",
        "Loyalty.activeEarners",
      ],
      timeDimensions: [
        { dimension: "Loyalty.eventTimestamp", dateRange: [dateRange.from, dateRange.to] },
      ],
    },
    tenantId
  );

  if (!rows || rows.length === 0) return null;
  const r = rows[0];

  return {
    from,
    to,
    kpis: {
      pointsIssued: r["Loyalty.pointsIssued"] ?? 0,
      pointsRedeemed: r["Loyalty.pointsRedeemed"] ?? 0,
      redemptionRatePct: r["Loyalty.redemptionRatePct"] ?? 0,
      activeEarners: r["Loyalty.activeEarners"] ?? 0,
    },
    _source: "clickhouse",
  };
}

// ─── Retail Cube wrapper ──────────────────────────────────────────────────────

async function getRetailSummaryFromCube(tenantId, channel = "pos", { from, to } = {}) {
  const dateRange = toDateRange({ from, to });
  if (!dateRange) return null;

  const rows = await cubeQuery(
    {
      measures: [
        "Sales.totalRevenueCents",
        "Sales.totalOrders",
        "Sales.avgOrderValueCents",
        "Sales.totalUnitsSold",
      ],
      filters: [{ member: "Sales.channel", operator: "equals", values: [channel] }],
      timeDimensions: [
        { dimension: "Sales.saleDate", dateRange: [dateRange.from, dateRange.to] },
      ],
    },
    tenantId
  );

  if (!rows || rows.length === 0) return null;
  const r = rows[0];

  return {
    channel,
    period: { from, to },
    kpis: {
      orders: r["Sales.totalOrders"] ?? 0,
      revenueCents: r["Sales.totalRevenueCents"] ?? 0,
      avgOrderValueCents: r["Sales.avgOrderValueCents"] ?? 0,
      totalItems: r["Sales.totalUnitsSold"] ?? 0,
    },
    _source: "clickhouse",
  };
}

async function getTopProductsFromCube(tenantId, channel = "pos", { from, to, limit = 10 } = {}) {
  const dateRange = toDateRange({ from, to });
  if (!dateRange) return null;

  const rows = await cubeQuery(
    {
      measures: ["SaleLines.totalRevenueCents", "SaleLines.totalQty"],
      dimensions: ["SaleLines.productName", "SaleLines.skuCode"],
      filters: [],
      timeDimensions: [
        { dimension: "SaleLines.saleTimestamp", dateRange: [dateRange.from, dateRange.to] },
      ],
      order: { "SaleLines.totalRevenueCents": "desc" },
      limit,
    },
    tenantId
  );

  if (!rows) return null;
  return rows.map((r) => ({
    skuCode: r["SaleLines.skuCode"],
    productName: r["SaleLines.productName"],
    qty: r["SaleLines.totalQty"] ?? 0,
    revenueCents: r["SaleLines.totalRevenueCents"] ?? 0,
    _source: "clickhouse",
  }));
}

// ─── Exported wrappers — try Cube, fall back to MongoDB ─────────────────────

export async function getFanCounters(tenantId, options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getFanCountersFromCube(tenantId, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const m = await getFanboxMongoService();
  return m.getFanCounters(tenantId, options);
}

export async function getFanGrowth(tenantId, options = {}) {
  const m = await getFanboxMongoService();
  return m.getFanGrowth(tenantId, options);
}

export async function getEngagementReports(tenantId, options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getEngagementReportsFromCube(tenantId, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const m = await getFanboxMongoService();
  return m.getEngagementReports(tenantId, options);
}

export async function getSpendReports(tenantId, options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getSpendReportsFromCube(tenantId, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const m = await getFanboxMongoService();
  return m.getSpendReports(tenantId, options);
}

export async function getMemberReports(tenantId, options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getMemberReportsFromCube(tenantId, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const { getMembershipAdvanced } = await getAdvancedKpiService();
  return getMembershipAdvanced(tenantId, options);
}

export async function getRevenueTrend(tenantId, options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getRevenueTrendFromCube(tenantId, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const m = await getFanboxMongoService();
  return m.getSpendReports(tenantId, options);
}

export async function getLoyaltyReports(tenantId, options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getLoyaltyReportsFromCube(tenantId, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const { getLoyaltyAdvanced } = await getAdvancedKpiService();
  return getLoyaltyAdvanced(tenantId, options);
}

export async function getRetailSummary(tenantId, channel = "pos", options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getRetailSummaryFromCube(tenantId, channel, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const { getRetailSummary: mongoFn } = await getRetailMongoService();
  return mongoFn(tenantId, channel, options);
}

export async function getTopProducts(tenantId, channel = "pos", options = {}) {
  if (isCubeEnabled()) {
    const cubeResult = await getTopProductsFromCube(tenantId, channel, options).catch(() => null);
    if (cubeResult) return cubeResult;
  }
  const { getTopProducts: mongoFn } = await getRetailMongoService();
  return mongoFn(tenantId, channel, options);
}

export async function getRevenueByLocation(tenantId, options = {}) {
  // No Cube model yet — uses MongoDB; migrates to Cube in a future iteration
  const { getRevenueByLocation: mongoFn } = await getRetailMongoService();
  return mongoFn(tenantId, options);
}

export async function getFanDemographics(tenantId, options = {}) {
  const m = await getFanboxMongoService();
  return m.getFanDemographics(tenantId, options);
}

export async function getBusinessReport(tenantId, source, options = {}) {
  const m = await getFanboxMongoService();
  return m.getBusinessReport(tenantId, source, options);
}
