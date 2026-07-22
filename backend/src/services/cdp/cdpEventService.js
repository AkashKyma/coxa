/**
 * CDP Event Service — Unified event pipeline for Coxa.
 *
 * This is the new entry point for ALL domain events. It:
 *  1. Sends the event to RudderStack (async, non-blocking)
 *  2. Persists locally to MongoDB via the legacy eventBus (ensures zero data loss)
 *  3. Optionally captures to PostHog for product analytics events
 *
 * Migration strategy (gradual, safe):
 *  - Phase 1: Dual-write — events go to BOTH RudderStack AND local MongoDB
 *  - Phase 2: Once RudderStack webhook is validated, disable direct MongoDB write
 *             and let the webhook handler persist (single write path)
 *
 * All existing callers of publishDomainEvent() are redirected here.
 */
import { getRudderClient, isRudderEnabled } from "./rudderClient.js";
import { getPostHogClient, isPostHogEnabled } from "./posthogClient.js";
import { ingestEvent as legacyIngestEvent } from "../eventBus.js";

const ANALYTICS_EVENTS = new Set([
  "sale.completed",
  "sale.returned",
  "ticket.purchased",
  "ticket.used",
  "membership.created",
  "membership.renewed",
  "membership.upgraded",
  "membership.cancelled",
  "fan.registered",
  "member.checked_in",
  "referral.confirmed",
  "loyalty.points.earned",
  "loyalty.points.redeemed",
  "loyalty.points.reversed",
  "loyalty.points.adjusted",
  "loyalty.reward.redeemed",
  "campaign.message.sent",
  "campaign.participated",
]);

/**
 * Map Coxa event names to RudderStack event naming convention.
 * RudderStack prefers "Title Case" or "snake_case" without dots.
 */
function toRudderEventName(eventName) {
  return eventName.replace(/\./g, "_");
}

/**
 * Publish a domain event through the CDP pipeline.
 *
 * @param {Object} params - Same shape as legacy publishDomainEvent
 * @param {string} params.tenantId
 * @param {string} params.eventName - e.g. "sale.completed"
 * @param {string} params.source - originating service
 * @param {string} [params.fanProfileId] - resolved fan profile ObjectId
 * @param {string} [params.fanId] - external fan identifier
 * @param {string} [params.fanEmail]
 * @param {string} params.idempotencyKey
 * @param {string|Date} [params.eventTimestamp]
 * @param {Object} [params.payload={}]
 * @param {number} [params.payloadVersion=1]
 */
export async function publishEvent({
  tenantId,
  eventName,
  source,
  fanProfileId,
  fanId,
  fanEmail,
  idempotencyKey,
  eventTimestamp,
  payload = {},
  payloadVersion = 1,
}) {
  const rudder = getRudderClient();
  const timestamp = eventTimestamp ? new Date(eventTimestamp) : new Date();

  // ── RudderStack track (non-blocking, fire-and-forget) ──────────────────
  if (rudder) {
    const userId = fanProfileId?.toString() || fanId || fanEmail || `anonymous-${tenantId}`;
    const rudderEvent = {
      userId,
      event: toRudderEventName(eventName),
      properties: {
        ...payload,
        coxa_event_name: eventName,
        coxa_source: source,
        coxa_tenant_id: tenantId,
        coxa_idempotency_key: idempotencyKey,
        coxa_payload_version: payloadVersion,
      },
      timestamp,
      context: {
        app: { name: "coxa-backend", version: "1.0.0" },
        traits: {
          tenantId,
          fanProfileId: fanProfileId?.toString(),
          fanId,
          fanEmail,
        },
      },
    };

    try {
      rudder.track(rudderEvent);
    } catch (err) {
      // Never let RudderStack failure block the business flow
      console.error("[CDP] RudderStack track failed (non-fatal):", err.message);
    }
  }

  // ── PostHog capture for analytics-significant events ───────────────────
  if (isPostHogEnabled() && ANALYTICS_EVENTS.has(eventName)) {
    const posthog = getPostHogClient();
    if (posthog) {
      const distinctId = fanProfileId?.toString() || fanId || fanEmail || `anon-${tenantId}`;
      try {
        posthog.capture({
          distinctId,
          event: eventName,
          properties: {
            ...payload,
            source,
            tenantId,
          },
          timestamp,
        });
      } catch (err) {
        console.error("[CDP] PostHog capture failed (non-fatal):", err.message);
      }
    }
  }

  // ── Legacy MongoDB persistence (Phase 1: dual-write for safety) ────────
  const result = await legacyIngestEvent({
    tenantId,
    eventName,
    source,
    fanProfileId,
    fanId,
    fanEmail,
    idempotencyKey,
    eventTimestamp,
    payload,
    payloadVersion,
  });

  return result;
}

/**
 * Identify a fan in RudderStack + PostHog (called on login, registration, profile update).
 * Links anonymous browsing sessions to a known fan profile.
 */
export function identifyFan({ tenantId, fanProfileId, traits = {} }) {
  const rudder = getRudderClient();
  if (rudder && fanProfileId) {
    rudder.identify({
      userId: fanProfileId.toString(),
      traits: {
        ...traits,
        tenantId,
      },
    });
  }

  if (isPostHogEnabled() && fanProfileId) {
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.identify({
        distinctId: fanProfileId.toString(),
        properties: {
          ...traits,
          tenantId,
        },
      });
    }
  }
}

/**
 * Alias an anonymous ID to a known fan profile (post-login identity merge).
 */
export function aliasFan({ previousId, fanProfileId }) {
  const rudder = getRudderClient();
  if (rudder && previousId && fanProfileId) {
    rudder.alias({
      previousId,
      userId: fanProfileId.toString(),
    });
  }

  if (isPostHogEnabled() && previousId && fanProfileId) {
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.alias({
        distinctId: fanProfileId.toString(),
        alias: previousId,
      });
    }
  }
}

// Re-export legacy functions for backward compatibility during migration
export { listEvents, replayDlqEvent } from "../eventBus.js";
