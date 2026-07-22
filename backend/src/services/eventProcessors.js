import { handleTraitUpdate } from "./traitCalculator.js";
import { handleLoyaltyEvent } from "./loyaltyService.js";
import { recalculateFanScore } from "./fanScoreService.js";

const SCORE_TRIGGER_EVENTS = new Set([
  "member.checked_in",
  "ticket.used",
  "no_show.recorded",
  "sale.completed",
  "ticket.purchased",
  "membership.created",
  "membership.renewed",
  "membership.upgraded",
  "referral.confirmed",
  "campaign.participated",
]);

export async function processEventSideEffects(event) {
  await handleTraitUpdate(event);
  await handleLoyaltyEvent(event);

  if (event.fanProfileId && SCORE_TRIGGER_EVENTS.has(event.eventName)) {
    await recalculateFanScore(event.tenantId, event.fanProfileId);
  }
}
