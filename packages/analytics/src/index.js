/**
 * @coxa/analytics — Unified browser analytics for all Coxa frontend apps.
 *
 * Wraps RudderStack JS SDK + PostHog for:
 *  - Automatic page view tracking
 *  - Custom event tracking (add to cart, view ticket, etc.)
 *  - Identity resolution (anonymous → identified fan)
 *  - Session replay via PostHog
 *  - A/B testing / feature flags via PostHog
 *
 * Usage in any Coxa React app:
 *   import { analytics } from "@coxa/analytics";
 *   analytics.init();  // call once on app mount
 *   analytics.page();  // on route change
 *   analytics.track("ticket_viewed", { matchId: "..." });
 *   analytics.identify(fanProfileId, { email, name });
 */
import { RudderAnalytics } from "@rudderstack/analytics-js";
import posthog from "posthog-js";

let rudder = null;
let posthogInitialized = false;

const RUDDERSTACK_WRITE_KEY = import.meta.env.VITE_RUDDERSTACK_WRITE_KEY;
const RUDDERSTACK_DATA_PLANE = import.meta.env.VITE_RUDDERSTACK_DATA_PLANE_URL;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST;

function initRudder() {
  if (rudder || !RUDDERSTACK_WRITE_KEY || !RUDDERSTACK_DATA_PLANE) return null;

  rudder = new RudderAnalytics();
  rudder.load(RUDDERSTACK_WRITE_KEY, RUDDERSTACK_DATA_PLANE, {
    integrations: { All: true },
    configUrl: RUDDERSTACK_DATA_PLANE,
    logLevel: import.meta.env.DEV ? "DEBUG" : "ERROR",
  });

  return rudder;
}

function initPostHog() {
  if (posthogInitialized || !POSTHOG_KEY || !POSTHOG_HOST) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: false, // we fire manually via analytics.page()
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.debug();
      }
    },
  });

  posthogInitialized = true;
}

export const analytics = {
  /**
   * Initialize all analytics SDKs. Call once at app root.
   */
  init() {
    initRudder();
    initPostHog();
  },

  /**
   * Track a page view.
   * @param {string} [name] - Page name (defaults to document.title)
   * @param {Object} [properties] - Extra properties
   */
  page(name, properties = {}) {
    const pageName = name || document.title;
    if (rudder) rudder.page("Coxa", pageName, properties);
    if (posthogInitialized) posthog.capture("$pageview", { ...properties, page_name: pageName });
  },

  /**
   * Track a custom event.
   * @param {string} event - Event name (e.g. "ticket_viewed", "product_added_to_cart")
   * @param {Object} [properties]
   */
  track(event, properties = {}) {
    if (rudder) rudder.track(event, properties);
    if (posthogInitialized) posthog.capture(event, properties);
  },

  /**
   * Identify a known fan (call after login or registration).
   * Links anonymous session to the fan profile.
   * @param {string} fanProfileId
   * @param {Object} [traits] - { email, name, memberId, ... }
   */
  identify(fanProfileId, traits = {}) {
    if (rudder) rudder.identify(fanProfileId, traits);
    if (posthogInitialized) posthog.identify(fanProfileId, traits);
  },

  /**
   * Reset identity (call on logout).
   */
  reset() {
    if (rudder) rudder.reset();
    if (posthogInitialized) posthog.reset();
  },

  /**
   * Group/associate fan with a tenant/club.
   * @param {string} groupId - tenantId or club identifier
   * @param {Object} [traits]
   */
  group(groupId, traits = {}) {
    if (rudder) rudder.group(groupId, traits);
    if (posthogInitialized) posthog.group("tenant", groupId, traits);
  },

  /**
   * Check if a feature flag is enabled (PostHog).
   * @param {string} flagKey
   * @returns {boolean}
   */
  isFeatureEnabled(flagKey) {
    if (!posthogInitialized) return false;
    return posthog.isFeatureEnabled(flagKey);
  },

  /**
   * Get feature flag payload (PostHog).
   * @param {string} flagKey
   * @returns {*}
   */
  getFeatureFlag(flagKey) {
    if (!posthogInitialized) return undefined;
    return posthog.getFeatureFlagPayload(flagKey);
  },

  /**
   * Access the raw PostHog instance for advanced use.
   */
  get posthog() {
    return posthogInitialized ? posthog : null;
  },

  /**
   * Access the raw RudderStack instance for advanced use.
   */
  get rudder() {
    return rudder;
  },
};

export default analytics;
