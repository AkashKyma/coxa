/**
 * Performance optimization: ensure all analytics-critical aggregation indexes exist.
 *
 * Run once at startup (called from ensureIndexes in server.js)
 * or via: node -e "import('./backend/src/lib/ensureIndexes.js').then(m => m.ensureAllIndexes())"
 */
import mongoose from "mongoose";

export async function ensureAllIndexes() {
  const db = mongoose.connection.db;
  if (!db) {
    console.warn("[ensureIndexes] MongoDB not connected, skipping.");
    return;
  }

  const ensure = async (collName, spec, opts = {}) => {
    try {
      await db.collection(collName).createIndex(spec, opts);
    } catch (e) {
      if (e.codeName !== "IndexKeySpecsConflict") {
        console.warn(`[ensureIndexes] ${collName}:`, e.message);
      }
    }
  };

  await Promise.all([
    // Sale — analytics aggregations
    ensure("sales", { tenantId: 1, channel: 1, createdAt: -1 }),
    ensure("sales", { tenantId: 1, locationId: 1, createdAt: -1 }),
    ensure("sales", { tenantId: 1, status: 1, paymentStatus: 1, createdAt: -1 }),
    ensure("sales", { tenantId: 1, fanProfileId: 1, createdAt: -1 }),
    ensure("sales", { "lines.categoryId": 1, tenantId: 1, createdAt: -1 }),

    // Ticket
    ensure("tickets", { tenantId: 1, status: 1, issuedAt: -1 }),
    ensure("tickets", { tenantId: 1, fanProfileId: 1, issuedAt: -1 }),

    // AttendanceRecord
    ensure("attendancerecords", { tenantId: 1, recordedAt: -1 }),
    ensure("attendancerecords", { tenantId: 1, fanProfileId: 1, recordedAt: -1 }),

    // FanMembership
    ensure("fanmemberships", { tenantId: 1, status: 1 }),
    ensure("fanmemberships", { tenantId: 1, fanProfileId: 1 }),

    // MembershipTransaction
    ensure("membershiptransactions", { tenantId: 1, status: 1, createdAt: -1 }),

    // LoyaltyLedgerEntry
    ensure("loyaltyledgerentries", { tenantId: 1, type: 1, createdAt: -1 }),
    ensure("loyaltyledgerentries", { tenantId: 1, fanProfileId: 1, createdAt: -1 }),

    // FanProfile
    ensure("fanprofiles", { tenantId: 1, status: 1, createdAt: -1 }),
    ensure("fanprofiles", { tenantId: 1, isForeigner: 1, status: 1 }),

    // SocialMetric
    ensure("socialmetrics", { tenantId: 1, source: 1, date: -1 }),
    ensure("socialmetrics", { tenantId: 1, channelId: 1, date: -1 }),
  ]);

  console.log("[ensureIndexes] All analytics indexes verified.");
}
