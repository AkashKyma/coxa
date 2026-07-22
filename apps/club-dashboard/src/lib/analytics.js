/**
 * club-dashboard/src/lib/analytics.js
 *
 * Staff-specific analytics wrapper for the club-dashboard.
 * Uses @coxa/analytics under the hood (RudderStack + PostHog).
 *
 * Plan spec (Phase 1):
 *  - Staff identity resolution on login (operator ID + club ID)
 *  - Page view tracking across all routes
 *  - Operational events: checkin_qr_validated, checkin_window_created,
 *    checkin_windows_synced, nbo_simulated, analytics_dashboard_loaded
 *
 * Usage:
 *   import { clubAnalytics } from "../lib/analytics.js";
 *
 *   // On login
 *   clubAnalytics.identifyStaff(userId, { email, name, role, clubId });
 *
 *   // On route change
 *   clubAnalytics.page("Gate Operations");
 *
 *   // On staff action
 *   clubAnalytics.checkinQrValidated({ matchEventId, fanId, gate });
 */

import { analytics } from "@coxa/analytics";

/** Shared super-properties attached to every club-dashboard event. */
let _staffContext = {};

export const clubAnalytics = {
  /**
   * Initialize analytics. Call once at app root (main.jsx or App.jsx).
   */
  init() {
    analytics.init();
  },

  /**
   * Identify a staff member after login.
   * @param {string} staffId
   * @param {{ email?: string, name?: string, role?: string, clubId?: string }} traits
   */
  identifyStaff(staffId, traits = {}) {
    _staffContext = {
      staff_id: staffId,
      club_id: traits.clubId ?? traits.club_id,
      staff_role: traits.role,
    };
    analytics.identify(staffId, {
      email: traits.email,
      name: traits.name,
      role: traits.role,
      club_id: traits.clubId ?? traits.club_id,
      actor_type: "staff",
    });
  },

  /**
   * Track a page view. Call on every React Router route change.
   * @param {string} pageName - Human-readable page name
   * @param {Object} [extra] - Extra properties
   */
  page(pageName, extra = {}) {
    analytics.page(pageName, { ..._staffContext, ...extra, dashboard: "club" });
  },

  /**
   * Reset staff identity on logout.
   */
  reset() {
    _staffContext = {};
    analytics.reset();
  },

  // ── Operational Event Helpers ────────────────────────────────────────────────

  /**
   * Fan QR scanned and validated at a gate.
   */
  checkinQrValidated({ matchEventId, fanId, fanProfileId, gate, ticketId, result } = {}) {
    analytics.track("checkin_qr_validated", {
      ..._staffContext,
      match_event_id: matchEventId,
      fan_id: fanId,
      fan_profile_id: fanProfileId,
      gate,
      ticket_id: ticketId,
      result, // "allowed" | "denied" | "already_used"
    });
  },

  /**
   * Staff created a new check-in window for a match event.
   */
  checkinWindowCreated({ matchEventId, windowLabel, gates } = {}) {
    analytics.track("checkin_window_created", {
      ..._staffContext,
      match_event_id: matchEventId,
      window_label: windowLabel,
      gate_count: Array.isArray(gates) ? gates.length : undefined,
    });
  },

  /**
   * Staff triggered a sync of check-in windows.
   */
  checkinWindowsSynced({ matchEventId, windowCount } = {}) {
    analytics.track("checkin_windows_synced", {
      ..._staffContext,
      match_event_id: matchEventId,
      window_count: windowCount,
    });
  },

  /**
   * Staff ran the NBO simulator on the Personalization dashboard.
   */
  nboSimulated({ fanProfileId, fanId, offersReturned, topOfferId, channel } = {}) {
    analytics.track("nbo_simulated", {
      ..._staffContext,
      fan_profile_id: fanProfileId,
      fan_id: fanId,
      offers_returned: offersReturned,
      top_offer_id: topOfferId,
      channel,
    });
  },

  /**
   * Staff loaded the analytics dashboard.
   */
  analyticsDashboardLoaded({ section, dateRange } = {}) {
    analytics.track("analytics_dashboard_loaded", {
      ..._staffContext,
      section, // "retail" | "fnb" | "ticketing" | "membership" | "loyalty" | "overview"
      date_range: dateRange,
    });
  },

  /**
   * Generic staff event — for any operational action not covered above.
   */
  track(event, properties = {}) {
    analytics.track(event, { ..._staffContext, ...properties, dashboard: "club" });
  },
};
