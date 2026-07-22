/**
 * useClubAnalytics — analytics integration for club-dashboard.
 *
 * Usage:
 *   import { useClubAnalytics } from "../../lib/useClubAnalytics.js";
 *   const { track } = useClubAnalytics();
 *   track("check_in_scanned", { matchEventId, fanId, gate, result });
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { analytics } from "@coxa/analytics";
import { useAuth } from "../context/AuthContext.jsx";

const PAGE_NAMES = {
  "/": "Overview",
  "/retail/sales": "Retail Sales",
  "/fnb/sales": "FnB Sales Dashboard",
  "/ticketing/check-in": "Check-in Dashboard",
  "/personalization": "Personalization",
  "/cdp/events": "CDP Events",
  "/cdp/segments": "CDP Segments",
  "/cdp/customer-360": "Customer 360",
  "/membership/members": "Members",
  "/loyalty": "Loyalty Rules",
};

/**
 * Place this hook once in App.jsx (inside AuthProvider) so it runs globally.
 * Tracks page views on route changes and identifies the operator on login.
 */
export function useClubAnalyticsGlobal() {
  const { user, club } = useAuth();
  const location = useLocation();
  const identifiedRef = useRef(false);

  // Identify operator and group to club once user is loaded
  useEffect(() => {
    if (!user || identifiedRef.current) return;
    identifiedRef.current = true;
    analytics.identify(user._id ?? user.id, {
      email: user.email,
      name: user.name ?? user.fullName,
      role: user.role,
      app: "club-dashboard",
    });
    if (club) {
      analytics.group(club._id ?? club.id, {
        name: club.name,
        sport: club.sport,
        plan: club.plan,
      });
    }
  }, [user, club]);

  // Track page view on every route change
  useEffect(() => {
    const name = PAGE_NAMES[location.pathname] ?? location.pathname;
    analytics.page(name, {
      path: location.pathname,
      app: "club-dashboard",
      clubId: club?._id ?? club?.id,
    });
  }, [location.pathname, club]);
}

/**
 * Lightweight hook that exposes a pre-bound track() helper.
 * Automatically injects clubId and app context into every event.
 */
export function useClubAnalytics() {
  const { club, user } = useAuth();
  const clubId = club?._id ?? club?.id;
  const userId = user?._id ?? user?.id;

  function track(event, properties = {}) {
    analytics.track(event, {
      ...properties,
      clubId,
      operatorId: userId,
      app: "club-dashboard",
    });
  }

  return { track };
}
