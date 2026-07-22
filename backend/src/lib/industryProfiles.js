/**
 * Industry Profile Registry (WS9).
 *
 * Defines which KPI keys and filter fields are active per industry.
 * The backend `/api/v1/meta` endpoints already support ?industry= filtering
 * via kpiRegistry and filterFields. This file provides the top-level profiles
 * and makes it easy to add new ones (e.g. basketball_club, esports, concert_venue).
 *
 * Selection: stored on TenantConfig.industryProfile
 */
import { getKpisByIndustry } from "./kpiRegistry.js";
import { getFilterFieldsByIndustry } from "./filterFields.js";

export const INDUSTRY_PROFILES = {
  football_club: {
    code: "football_club",
    label: "Professional Football Club",
    description: "Fan base management, ticketing, merchandise, F&B, and membership for professional football.",
    departments: ["fans", "membership", "tickets", "access", "stores", "ecommerce", "coxa-foods", "loyalty", "social"],
    defaultDashboardTabs: ["overview", "fans", "membership", "tickets", "stores", "loyalty", "social"],
  },
  basketball_club: {
    code: "basketball_club",
    label: "Basketball Club",
    description: "Adapted for basketball venues and fan engagement.",
    departments: ["fans", "membership", "tickets", "access", "stores", "loyalty"],
    defaultDashboardTabs: ["overview", "fans", "tickets", "stores"],
  },
  concert_venue: {
    code: "concert_venue",
    label: "Concert / Event Venue",
    description: "Ticketing, F&B, and artist fan communities.",
    departments: ["fans", "tickets", "access", "coxa-foods", "loyalty"],
    defaultDashboardTabs: ["overview", "tickets", "coxa-foods"],
  },
};

/**
 * Get the KPIs + filter fields for a given industry profile.
 */
export function getProfileCatalog(industryCode) {
  const profile = INDUSTRY_PROFILES[industryCode];
  if (!profile) throw new Error(`Unknown industry profile: ${industryCode}`);
  return {
    profile,
    kpis: getKpisByIndustry(industryCode),
    filterFields: getFilterFieldsByIndustry(industryCode),
  };
}

export function listIndustryProfiles() {
  return Object.values(INDUSTRY_PROFILES);
}
