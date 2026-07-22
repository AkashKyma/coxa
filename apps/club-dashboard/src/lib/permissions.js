/**
 * Frontend RBAC — maps membership.role values to allowed module keys.
 * Module keys match the NavSection identifiers in DashboardLayout.
 */

/** Module keys used to gate nav sections and routes */
export const MODULE = {
  ADMIN: "admin",
  RETAIL: "retail",
  FNB: "fnb",
  TICKETING: "ticketing",
  CDP: "cdp",
  PERSONALIZATION: "personalization",
  LOYALTY: "loyalty",
  MEMBERSHIP: "membership",
  SUPPORT: "support",
};

/**
 * Roles that get access to everything (no filtering).
 * Matches the string values stored in membership.role from the API.
 */
const SUPERUSER_ROLES = new Set([
  "owner",
  "admin",
  "club_admin",
  "module_admin",
  "platform_super_admin",
]);

/**
 * Maps a role string → set of allowed module keys.
 * Used for sidebar visibility and route protection.
 */
const ROLE_MODULE_MAP = {
  // Ticketing roles
  ticketing_manager: [MODULE.TICKETING, MODULE.SUPPORT, MODULE.MEMBERSHIP],
  membership_manager: [MODULE.TICKETING, MODULE.MEMBERSHIP],
  box_office_operator: [MODULE.TICKETING],
  gate_supervisor: [MODULE.TICKETING, MODULE.SUPPORT],
  gate_operator: [MODULE.TICKETING],

  // Retail roles
  retail_manager: [MODULE.RETAIL, MODULE.ADMIN],
  store_manager: [MODULE.RETAIL],
  pos_cashier: [MODULE.RETAIL, MODULE.FNB],
  warehouse_inventory_manager: [MODULE.RETAIL],

  // F&B roles
  fb_manager: [MODULE.FNB, MODULE.RETAIL],
  stand_manager: [MODULE.FNB],
  kitchen_prep_staff: [MODULE.FNB],

  // Marketing / CDP
  cdp_data_analyst: [MODULE.CDP, MODULE.PERSONALIZATION],
  marketing_manager: [MODULE.CDP, MODULE.PERSONALIZATION, MODULE.LOYALTY, MODULE.MEMBERSHIP],
  loyalty_manager: [MODULE.LOYALTY, MODULE.CDP, MODULE.MEMBERSHIP],

  // Support
  support_agent: [MODULE.SUPPORT, MODULE.CDP],
  support_manager: [MODULE.SUPPORT, MODULE.CDP, MODULE.ADMIN],

  // Finance / Exec viewers — read dashboards only
  finance_manager: [MODULE.RETAIL, MODULE.FNB, MODULE.TICKETING],
  executive_viewer: [MODULE.RETAIL, MODULE.FNB, MODULE.TICKETING, MODULE.CDP],

  // Fan — should not be using club-dashboard at all
  fan_member: [],
};

/**
 * Returns the set of allowed module keys for a given role string.
 * Superuser roles return a Set containing all modules.
 */
export function getAllowedModules(role) {
  if (!role) return new Set();
  const normalised = role.toLowerCase();
  if (SUPERUSER_ROLES.has(normalised)) {
    return new Set(Object.values(MODULE));
  }
  const allowed = ROLE_MODULE_MAP[normalised];
  return new Set(allowed ?? []);
}

/**
 * React hook — returns { can, allowedModules } for the current session.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   if (can(MODULE.RETAIL)) { ... }
 */
import { useMemo } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export function usePermissions() {
  const { membership } = useAuth();
  const role = membership?.role ?? null;

  const allowedModules = useMemo(() => getAllowedModules(role), [role]);

  return {
    /** True if the current user can access the given module key */
    can: (moduleKey) => allowedModules.has(moduleKey),
    allowedModules,
    role,
    isAdmin: role ? SUPERUSER_ROLES.has(role.toLowerCase()) : false,
  };
}
