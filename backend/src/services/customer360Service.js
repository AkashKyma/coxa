import { FanProfile } from "../models/FanProfile.js";
import { Sale } from "../models/Sale.js";
import { Ticket } from "../models/Ticket.js";
import { CdpEvent } from "../models/CdpEvent.js";
import { findFanProfile, maskEmail, maskPhone } from "./fanProfileService.js";
import { getFanTraits } from "./traitCalculator.js";
import { getFanSegments } from "./segmentService.js";
import { getBalance, getLedger } from "./loyaltyService.js";

export async function buildCustomer360(tenantId, fanProfileId, { revealPii = false } = {}) {
  const profile = await FanProfile.findOne({ _id: fanProfileId, tenantId, status: "active" });
  if (!profile) {
    const err = new Error("Fan profile not found");
    err.status = 404;
    err.code = "FAN_NOT_FOUND";
    throw err;
  }

  const [traits, segments, balance, recentEvents, recentSales, recentTickets, ledger] =
    await Promise.all([
      getFanTraits(tenantId, fanProfileId),
      getFanSegments(tenantId, fanProfileId),
      getBalance(tenantId, fanProfileId),
      CdpEvent.find({ tenantId, fanProfileId }).sort({ eventTimestamp: -1 }).limit(20),
      Sale.find({ tenantId, fanProfileId, status: "completed" }).sort({ createdAt: -1 }).limit(10),
      Ticket.find({ tenantId, fanProfileId })
        .sort({ issuedAt: -1 })
        .limit(10)
        .populate("matchEventId", "title eventCode startsAt homeTeam awayTeam"),
      getLedger(tenantId, fanProfileId, 10),
    ]);

  const maskedProfile = {
    id: profile.id,
    fanId: profile.fanId,
    fullName: profile.fullName,
    email: revealPii ? profile.email : maskEmail(profile.email),
    phone: revealPii ? profile.phone : maskPhone(profile.phone),
    memberId: profile.memberId,
    status: profile.status,
    createdAt: profile.createdAt,
  };

  return {
    profile: maskedProfile,
    traits,
    segments: segments.map((s) => ({ id: s.id, name: s.name, description: s.description })),
    loyalty: { balance, recentLedger: ledger },
    recentEvents,
    recentSales,
    recentTickets,
    summary: {
      totalRetailSpendCents: Number(traits.total_retail_spend_cents ?? 0),
      purchaseCount: Number(traits.retail_purchase_count ?? 0),
      ticketCount: Number(traits.ticket_purchase_count ?? 0),
      attendanceCount: Number(traits.match_attendance_count ?? 0),
      pointsBalance: balance,
      segmentCount: segments.length,
    },
  };
}

export async function lookupCustomer360(tenantId, query, options = {}) {
  const profile = await findFanProfile(tenantId, {
    fanProfileId: /^[a-f\d]{24}$/i.test(query) ? query : undefined,
    fanId: query.startsWith("fan-") ? query : undefined,
    email: query.includes("@") ? query : undefined,
  });

  if (!profile) {
    const err = new Error("Fan profile not found");
    err.status = 404;
    err.code = "FAN_NOT_FOUND";
    throw err;
  }

  return buildCustomer360(tenantId, profile._id, options);
}
