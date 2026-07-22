/**
 * React hook for Coxa analytics — auto-initializes on mount,
 * tracks page views on route changes, exposes track/identify methods.
 *
 * Usage:
 *   import { useAnalytics } from "@coxa/analytics/react";
 *
 *   function App() {
 *     useAnalytics(); // auto-init + page tracking
 *     return <Router>...</Router>;
 *   }
 *
 *   // In any component:
 *   import { useAnalytics } from "@coxa/analytics/react";
 *   const { track, identify } = useAnalytics();
 *   track("ticket_viewed", { matchId });
 */
import { useEffect, useRef } from "react";
import { analytics } from "./index.js";

/**
 * useAnalytics — initialises SDKs once and fires a page view on every
 * client-side navigation (history API + hashchange).
 *
 * NOTE: Does not depend on react-router-dom so it works in any React app
 * (fan-landing, fan-auth, fan-dashboard, fanbox-dashboard, club-dashboard).
 * Apps that already use useClubAnalyticsGlobal should NOT also call this hook
 * to avoid duplicate page events.
 */
export function useAnalytics() {
  const initialized = useRef(false);

  // Initialise once on first mount
  useEffect(() => {
    if (!initialized.current) {
      analytics.init();
      initialized.current = true;
    }
  }, []);

  // Fire initial page view
  useEffect(() => {
    analytics.page();
  }, []);

  // Track subsequent SPA navigations via History API interception
  useEffect(() => {
    let lastPath = window.location.pathname + window.location.search;

    function handleNavigation() {
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== lastPath) {
        lastPath = currentPath;
        analytics.page();
      }
    }

    // Wrap pushState / replaceState so we hear programmatic navigations
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = function (...args) {
      origPush(...args);
      handleNavigation();
    };
    history.replaceState = function (...args) {
      origReplace(...args);
      handleNavigation();
    };

    // Browser back/forward buttons
    window.addEventListener("popstate", handleNavigation);

    return () => {
      window.removeEventListener("popstate", handleNavigation);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  return analytics;
}

export { analytics };
