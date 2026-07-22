/**
 * Coxa CDP Event Schema Registry
 *
 * Defines all event types, their sources, and expected payloads.
 * Used by:
 *  - RudderStack transformations (validation)
 *  - Backend event bus (allowlist)
 *  - Documentation generation
 *  - Frontend tracking plan enforcement
 */

export const EVENT_SCHEMAS = {
  // ── Retail ─────────────────────────────────────────────────────────────────
  "sale.completed": {
    description: "A retail sale was completed at POS or fan shop",
    sources: ["retail_pos", "fan_shop"],
    requiresFanProfile: true,
    payload: {
      saleId: "string",
      saleNumber: "string",
      totalCents: "number",
      lineCount: "number",
      paymentMethod: "string",
      channel: "string",
    },
  },
  "sale.returned": {
    description: "Items from a sale were returned",
    sources: ["retail_pos"],
    requiresFanProfile: true,
    payload: {
      returnId: "string",
      saleId: "string",
      refundCents: "number",
      lineCount: "number",
    },
  },

  // ── Inventory ──────────────────────────────────────────────────────────────
  "stock.transferred": {
    description: "Stock was transferred between locations",
    sources: ["inventory_service"],
    requiresFanProfile: false,
    payload: {
      transferId: "string",
      transferNumber: "string",
      fromLocationId: "string",
      toLocationId: "string",
      lineCount: "number",
    },
  },
  "wastage.recorded": {
    description: "Food/beverage lot expired or was written off",
    sources: ["fnb_inventory"],
    requiresFanProfile: false,
    payload: {
      lotId: "string",
      lotNumber: "string",
      skuId: "string",
      qtyWasted: "number",
      reason: "string",
    },
  },

  // ── Fan Lifecycle ──────────────────────────────────────────────────────────
  "fan.registered": {
    description: "A new fan signed up and created a profile",
    sources: ["fan_auth", "seed"],
    requiresFanProfile: true,
    payload: { email: "string", memberId: "string" },
  },
  "fan.updated": {
    description: "Fan profile information was updated",
    sources: ["fan_app", "club_dashboard"],
    requiresFanProfile: true,
    payload: { fields: "string[]" },
  },

  // ── Loyalty ────────────────────────────────────────────────────────────────
  "loyalty.points.earned": {
    description: "Fan earned loyalty points from an action",
    sources: ["loyalty_service"],
    requiresFanProfile: true,
    payload: { points: "number", reason: "string", transactionId: "string" },
  },
  "loyalty.points.redeemed": {
    description: "Fan redeemed loyalty points for a reward",
    sources: ["loyalty_service"],
    requiresFanProfile: true,
    payload: { points: "number", rewardCode: "string" },
  },
  "loyalty.points.reversed": {
    description: "Points were reversed (e.g. sale return)",
    sources: ["loyalty_service"],
    requiresFanProfile: true,
    payload: { points: "number", reason: "string" },
  },
  "loyalty.points.adjusted": {
    description: "Manual point adjustment by admin",
    sources: ["loyalty_service"],
    requiresFanProfile: true,
    payload: { points: "number", reason: "string", adjustedBy: "string" },
  },
  "loyalty.reward.redeemed": {
    description: "A loyalty reward was redeemed in-store",
    sources: ["loyalty_service"],
    requiresFanProfile: true,
    payload: { rewardId: "string", rewardCode: "string" },
  },

  // ── Ticketing ──────────────────────────────────────────────────────────────
  "event.created": {
    description: "A new match/event was created",
    sources: ["ticketing_service"],
    requiresFanProfile: false,
    payload: { eventId: "string", eventCode: "string", title: "string" },
  },
  "ticket.reserved": {
    description: "Fan reserved tickets (15-min hold)",
    sources: ["fan_app", "box_office"],
    requiresFanProfile: true,
    payload: {
      reservationId: "string",
      reservationNumber: "string",
      matchEventId: "string",
      qty: "number",
      totalCents: "number",
    },
  },
  "ticket.purchased": {
    description: "Ticket reservation was paid / confirmed",
    sources: ["fan_app", "box_office", "ticketing_service"],
    requiresFanProfile: true,
    payload: {
      matchEventId: "string",
      eventTitle: "string",
      qty: "number",
      totalCents: "number",
      channel: "string",
    },
  },
  "ticket.used": {
    description: "Fan entered the venue (gate scan)",
    sources: ["gate_access"],
    requiresFanProfile: true,
    payload: { entitlementId: "string", ticketId: "string", matchEventId: "string" },
  },

  // ── Attendance ─────────────────────────────────────────────────────────────
  "member.checked_in": {
    description: "Member checked in at a match event",
    sources: ["ticketing_service"],
    requiresFanProfile: true,
    payload: { matchEventId: "string", memberId: "string" },
  },
  "no_show.recorded": {
    description: "Fan had a ticket but did not attend",
    sources: ["ticketing_service"],
    requiresFanProfile: true,
    payload: { ticketId: "string", matchEventId: "string" },
  },

  // ── Membership ─────────────────────────────────────────────────────────────
  "membership.created": {
    description: "Fan signed up for a membership plan",
    sources: ["membership_service"],
    requiresFanProfile: true,
    payload: { membershipId: "string", planCode: "string", frequency: "string" },
  },
  "membership.renewed": {
    description: "Membership was renewed (auto or manual)",
    sources: ["membership_service"],
    requiresFanProfile: true,
    payload: { membershipId: "string", planCode: "string" },
  },
  "membership.upgraded": {
    description: "Fan upgraded to a higher membership tier",
    sources: ["membership_service"],
    requiresFanProfile: true,
    payload: { membershipId: "string", fromPlanCode: "string", toPlanCode: "string" },
  },
  "membership.cancelled": {
    description: "Membership was cancelled",
    sources: ["membership_service"],
    requiresFanProfile: true,
    payload: { membershipId: "string", planCode: "string", reason: "string" },
  },

  // ── Referral ───────────────────────────────────────────────────────────────
  "referral.confirmed": {
    description: "A referred fan completed signup — referrer rewarded",
    sources: ["referral_service"],
    requiresFanProfile: true,
    payload: {
      referralId: "string",
      referrerFanProfileId: "string",
      referredFanProfileId: "string",
    },
  },

  // ── Campaigns ──────────────────────────────────────────────────────────────
  "segment.evaluated": {
    description: "A segment rule was evaluated (batch or real-time)",
    sources: ["segment_service"],
    requiresFanProfile: false,
    payload: { segmentId: "string", matchCount: "number" },
  },
  "campaign.message.sent": {
    description: "A campaign message was dispatched to a fan",
    sources: ["campaign_service"],
    requiresFanProfile: true,
    payload: { campaignId: "string", channel: "string", templateId: "string" },
  },
  "campaign.participated": {
    description: "Fan engaged with a campaign (clicked, opened, redeemed)",
    sources: ["campaign_service"],
    requiresFanProfile: true,
    payload: { campaignId: "string", action: "string" },
  },

  // ── Web/App Tracking (captured by RudderStack JS/Mobile SDK) ───────────────
  "page_viewed": {
    description: "Fan viewed a page on the web portal",
    sources: ["web_sdk", "mobile_sdk"],
    requiresFanProfile: false,
    payload: { url: "string", title: "string", referrer: "string" },
  },
  "product_viewed": {
    description: "Fan viewed a product in the fan shop",
    sources: ["web_sdk", "mobile_sdk"],
    requiresFanProfile: false,
    payload: { productId: "string", productName: "string", category: "string" },
  },
  "product_added_to_cart": {
    description: "Fan added an item to cart",
    sources: ["web_sdk", "mobile_sdk"],
    requiresFanProfile: false,
    payload: { productId: "string", qty: "number", priceCents: "number" },
  },
  "match_viewed": {
    description: "Fan viewed a match/event details page",
    sources: ["web_sdk", "mobile_sdk"],
    requiresFanProfile: false,
    payload: { matchEventId: "string", eventTitle: "string" },
  },
};

export const ALL_EVENT_NAMES = Object.keys(EVENT_SCHEMAS);

export function isValidEventName(name) {
  return name in EVENT_SCHEMAS;
}
