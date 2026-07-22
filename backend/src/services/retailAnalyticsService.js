import { Sale } from "../models/Sale.js";
import { resolvePeriod, getPreviousPeriod } from "./periodService.js";

function pctDelta(curr, prev) {
  if (prev == null) return null;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(2));
}

function buildQuery(tenantId, channel, { from, to } = {}) {
  const q = { tenantId, status: "completed", channel };
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }
  return q;
}

/**
 * Summary KPIs for a retail channel (pos | fan_shop | coxa-foods).
 * Returns totals, location breakdown, top products, top categories, hour/DOW heatmap.
 */
export async function getRetailSummary(tenantId, channel = "pos", { from, to } = {}) {
  const range = { from, to };
  const prev = getPreviousPeriod(range);
  const q = buildQuery(tenantId, channel, range);
  const qPrev = prev ? buildQuery(tenantId, channel, prev) : null;

  const [summaryAgg, locationAgg, categoryAgg, hourAgg, dowAgg, prevSummary] = await Promise.all([
    Sale.aggregate([
      { $match: q },
      { $group: { _id: null, orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" }, uniqueFans: { $addToSet: "$fanProfileId" }, totalItems: { $sum: { $sum: "$lines.qty" } } } },
    ]),
    Sale.aggregate([
      { $match: q },
      { $group: { _id: "$locationId", locationName: { $first: { $arrayElemAt: ["$lines.locationName", 0] } }, orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" } } },
      { $sort: { revenueCents: -1 } },
      { $limit: 10 },
    ]),
    Sale.aggregate([
      { $match: q },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.categoryId", categoryName: { $first: "$lines.categoryName" }, qty: { $sum: "$lines.qty" }, revenueCents: { $sum: "$lines.lineTotalCents" } } },
      { $sort: { revenueCents: -1 } },
      { $limit: 10 },
    ]),
    Sale.aggregate([
      { $match: q },
      { $unwind: "$lines" },
      { $match: { "lines.hourOfDay": { $exists: true, $ne: null } } },
      { $group: { _id: "$lines.hourOfDay", revenueCents: { $sum: "$lines.lineTotalCents" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Sale.aggregate([
      { $match: q },
      { $unwind: "$lines" },
      { $match: { "lines.dayOfWeek": { $exists: true, $ne: null } } },
      { $group: { _id: "$lines.dayOfWeek", revenueCents: { $sum: "$lines.lineTotalCents" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    qPrev ? Sale.aggregate([
      { $match: qPrev },
      { $group: { _id: null, orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" } } },
    ]) : Promise.resolve(null),
  ]);

  const totals = summaryAgg[0] ?? { orders: 0, revenueCents: 0, uniqueFans: [], totalItems: 0 };
  const prevTotals = prevSummary?.[0] ?? null;
  const avgOrderValueCents = totals.orders ? Math.round(totals.revenueCents / totals.orders) : 0;
  const avgItemsPerOrder = totals.orders ? Number((totals.totalItems / totals.orders).toFixed(2)) : 0;

  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    channel,
    period: { from, to },
    kpis: {
      orders: totals.orders,
      revenueCents: totals.revenueCents,
      uniqueBuyers: totals.uniqueFans.filter(Boolean).length,
      avgOrderValueCents,
      avgItemsPerOrder,
      totalItems: totals.totalItems,
      bestLocationName: locationAgg[0] ? (locationAgg[0].locationName ?? String(locationAgg[0]._id)) : null,
      worstLocationName: locationAgg.length > 1 ? (locationAgg[locationAgg.length - 1].locationName ?? String(locationAgg[locationAgg.length - 1]._id)) : null,
    },
    previousPeriod: prevTotals ? {
      orders: prevTotals.orders,
      revenueCents: prevTotals.revenueCents,
      revenueDeltaPct: pctDelta(totals.revenueCents, prevTotals.revenueCents),
      ordersDeltaPct: pctDelta(totals.orders, prevTotals.orders),
    } : null,
    byLocation: locationAgg.map((l) => ({
      locationId: l._id,
      locationName: l.locationName ?? String(l._id),
      orders: l.orders,
      revenueCents: l.revenueCents,
    })),
    top5Locations: locationAgg.slice(0, 5).map((l) => ({
      locationName: l.locationName ?? String(l._id), orders: l.orders, revenueCents: l.revenueCents,
    })),
    byCategory: categoryAgg.map((c) => ({
      categoryId: c._id,
      categoryName: c.categoryName ?? String(c._id),
      qty: c.qty,
      revenueCents: c.revenueCents,
    })),
    top5Categories: categoryAgg.slice(0, 5),
    byHour: hourAgg.map((h) => ({ hour: h._id, label: `${String(h._id).padStart(2, "0")}:00`, revenueCents: h.revenueCents, orders: h.orders })),
    byDayOfWeek: dowAgg.map((d) => ({ dow: d._id, label: DOW_LABELS[d._id] ?? d._id, revenueCents: d.revenueCents, orders: d.orders })),
  };
}

/**
 * Top-N products by revenue (WS1.9).
 */
export async function getTopProducts(tenantId, channel = "pos", { from, to, limit = 10 } = {}) {
  const q = buildQuery(tenantId, channel, { from, to });
  const rows = await Sale.aggregate([
    { $match: q },
    { $unwind: "$lines" },
    { $group: { _id: "$lines.skuCode", productName: { $first: "$lines.productName" }, qty: { $sum: "$lines.qty" }, revenueCents: { $sum: "$lines.lineTotalCents" } } },
    { $sort: { revenueCents: -1 } },
    { $limit: Number(limit) },
  ]);
  return rows.map((r) => ({ skuCode: r._id, productName: r.productName, qty: r.qty, revenueCents: r.revenueCents }));
}

/**
 * Revenue by store/location comparison (WS4.2).
 */
export async function getRevenueByLocation(tenantId, { from, to } = {}) {
  const q = buildQuery(tenantId, "pos", { from, to });
  const rows = await Sale.aggregate([
    { $match: q },
    { $group: { _id: "$locationId", orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" } } },
    { $sort: { revenueCents: -1 } },
    { $lookup: { from: "locations", localField: "_id", foreignField: "_id", as: "loc" } },
    { $unwind: { path: "$loc", preserveNullAndEmptyArrays: true } },
  ]);
  return rows.map((r) => ({
    locationId: r._id,
    locationName: r.loc?.name ?? String(r._id),
    orders: r.orders,
    revenueCents: r.revenueCents,
  }));
}

/**
 * Backfill migration — enriches existing Sale.lines with hourOfDay + dayOfWeek from parent sale createdAt.
 * Intended for one-time migration scripts, not regular API traffic.
 */
export async function backfillSaleLineDenormalization(tenantId, { batchSize = 500, dryRun = false } = {}) {
  const cursor = Sale.find({ tenantId, "lines.hourOfDay": { $exists: false } }).cursor();
  let processed = 0;
  let updated = 0;
  for await (const sale of cursor) {
    const h = sale.createdAt?.getHours() ?? null;
    const d = sale.createdAt?.getDay() ?? null;
    for (const line of sale.lines) {
      if (h != null) line.hourOfDay = h;
      if (d != null) line.dayOfWeek = d;
    }
    processed++;
    if (!dryRun) { await sale.save(); updated++; }
  }
  return { processed, updated, dryRun };
}
