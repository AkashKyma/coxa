/**
 * Permission matrix for Coxa admin platform.
 *
 * Each entry maps a `PERMISSION` string to a set of `RoleCode`s that hold it.
 * Higher-level roles (Admin, Manager) inherit all Viewer permissions.
 *
 * Groups:
 *   analytics.*   – KPI dashboards, reports
 *   fans.*        – fan profiles, CRM
 *   filters.*     – saved filter management
 *   tickets.*     – ticketing, events
 *   membership.*  – membership plans & billing
 *   retail.*      – POS, catalog, stock
 *   fnb.*         – F&B operations
 *   loyalty.*     – points, tiers, rewards
 *   campaigns.*   – marketing campaigns
 *   rbac.*        – roles, permission overrides
 *   labels.*      – custom entity labels (WS12)
 *   social.*      – social media monitoring (WS7)
 *   ai.*          – AI insights, chatbot (WS8)
 */

export const PERMISSION = {
  // analytics
  ANALYTICS_VIEW:           "analytics.view",
  ANALYTICS_EXPORT:         "analytics.export",
  // fans
  FANS_VIEW:                "fans.view",
  FANS_EDIT:                "fans.edit",
  FANS_DELETE:              "fans.delete",
  FANS_IMPORT:              "fans.import",
  FANS_EXPORT:              "fans.export",
  FANS_VIEW_SINGLE:         "fans.view_single",
  // filters
  FILTERS_VIEW:             "filters.view",
  FILTERS_CREATE:           "filters.create",
  FILTERS_DELETE:           "filters.delete",
  FILTERS_PROMOTE:          "filters.promote",
  // tickets
  TICKETS_VIEW:             "tickets.view",
  TICKETS_CREATE:           "tickets.create",
  TICKETS_CANCEL:           "tickets.cancel",
  TICKETS_MANAGE:           "tickets.manage",
  // membership
  MEMBERSHIP_VIEW:          "membership.view",
  MEMBERSHIP_MANAGE:        "membership.manage",
  MEMBERSHIP_BILLING:       "membership.billing",
  // retail
  RETAIL_VIEW:              "retail.view",
  RETAIL_SELL:              "retail.sell",
  RETAIL_MANAGE_CATALOG:    "retail.manage_catalog",
  RETAIL_MANAGE_STOCK:      "retail.manage_stock",
  RETAIL_REPORTS:           "retail.reports",
  // F&B
  FNB_VIEW:                 "fnb.view",
  FNB_MANAGE:               "fnb.manage",
  // loyalty
  LOYALTY_VIEW:             "loyalty.view",
  LOYALTY_MANAGE:           "loyalty.manage",
  LOYALTY_ADJUST:           "loyalty.adjust",
  // campaigns
  CAMPAIGNS_VIEW:           "campaigns.view",
  CAMPAIGNS_CREATE:         "campaigns.create",
  CAMPAIGNS_SEND:           "campaigns.send",
  // RBAC
  RBAC_VIEW_ROLES:          "rbac.view_roles",
  RBAC_MANAGE_ROLES:        "rbac.manage_roles",
  RBAC_OVERRIDE_PERMISSIONS:"rbac.override_permissions",
  // labels (WS12)
  LABELS_VIEW:              "labels.view",
  LABELS_MANAGE:            "labels.manage",
  // social (WS7)
  SOCIAL_VIEW:              "social.view",
  SOCIAL_MANAGE:            "social.manage",
  // AI (WS8)
  AI_INSIGHTS_VIEW:         "ai.insights_view",
  AI_CHATBOT:               "ai.chatbot",
};

/**
 * PERMISSION_MATRIX:
 *   permission → array of role codes that are granted it
 */
export const PERMISSION_MATRIX = {
  // ── Analytics ──────────────────────────────────────────────────────────
  [PERMISSION.ANALYTICS_VIEW]: [
    "platform_super_admin", "club_admin", "module_admin",
    "executive_viewer", "cdp_data_analyst", "marketing_manager",
    "loyalty_manager", "ticketing_manager", "membership_manager",
    "retail_manager", "finance_manager", "auditor", "support_manager",
  ],
  [PERMISSION.ANALYTICS_EXPORT]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst",
    "finance_manager", "executive_viewer",
  ],

  // ── Fans ──────────────────────────────────────────────────────────────
  [PERMISSION.FANS_VIEW]: [
    "platform_super_admin", "club_admin", "module_admin",
    "cdp_data_analyst", "marketing_manager", "support_manager", "support_agent",
    "membership_manager", "loyalty_manager",
  ],
  [PERMISSION.FANS_EDIT]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst", "support_manager",
  ],
  [PERMISSION.FANS_DELETE]: [
    "platform_super_admin", "club_admin",
  ],
  [PERMISSION.FANS_IMPORT]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst",
  ],
  [PERMISSION.FANS_EXPORT]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst", "finance_manager",
  ],
  [PERMISSION.FANS_VIEW_SINGLE]: [
    "platform_super_admin", "club_admin", "module_admin",
    "cdp_data_analyst", "marketing_manager", "support_manager", "support_agent",
    "membership_manager", "loyalty_manager",
  ],

  // ── Filters ───────────────────────────────────────────────────────────
  [PERMISSION.FILTERS_VIEW]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst",
    "marketing_manager", "support_manager",
  ],
  [PERMISSION.FILTERS_CREATE]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst", "marketing_manager",
  ],
  [PERMISSION.FILTERS_DELETE]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst",
  ],
  [PERMISSION.FILTERS_PROMOTE]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst", "marketing_manager",
  ],

  // ── Tickets ───────────────────────────────────────────────────────────
  [PERMISSION.TICKETS_VIEW]: [
    "platform_super_admin", "club_admin", "ticketing_manager", "box_office_operator",
    "gate_supervisor", "gate_operator", "support_manager", "support_agent",
    "membership_manager", "executive_viewer",
  ],
  [PERMISSION.TICKETS_CREATE]: [
    "platform_super_admin", "club_admin", "ticketing_manager", "box_office_operator",
  ],
  [PERMISSION.TICKETS_CANCEL]: [
    "platform_super_admin", "club_admin", "ticketing_manager", "box_office_operator",
    "support_manager",
  ],
  [PERMISSION.TICKETS_MANAGE]: [
    "platform_super_admin", "club_admin", "ticketing_manager",
  ],

  // ── Membership ────────────────────────────────────────────────────────
  [PERMISSION.MEMBERSHIP_VIEW]: [
    "platform_super_admin", "club_admin", "membership_manager",
    "support_manager", "support_agent", "executive_viewer", "finance_manager",
  ],
  [PERMISSION.MEMBERSHIP_MANAGE]: [
    "platform_super_admin", "club_admin", "membership_manager",
  ],
  [PERMISSION.MEMBERSHIP_BILLING]: [
    "platform_super_admin", "club_admin", "membership_manager", "finance_manager",
  ],

  // ── Retail ────────────────────────────────────────────────────────────
  [PERMISSION.RETAIL_VIEW]: [
    "platform_super_admin", "club_admin", "retail_manager", "store_manager",
    "pos_cashier", "executive_viewer", "finance_manager",
  ],
  [PERMISSION.RETAIL_SELL]: [
    "platform_super_admin", "club_admin", "retail_manager", "store_manager", "pos_cashier",
  ],
  [PERMISSION.RETAIL_MANAGE_CATALOG]: [
    "platform_super_admin", "club_admin", "retail_manager",
  ],
  [PERMISSION.RETAIL_MANAGE_STOCK]: [
    "platform_super_admin", "club_admin", "retail_manager", "store_manager",
    "warehouse_inventory_manager",
  ],
  [PERMISSION.RETAIL_REPORTS]: [
    "platform_super_admin", "club_admin", "retail_manager", "finance_manager", "executive_viewer",
  ],

  // ── F&B ───────────────────────────────────────────────────────────────
  [PERMISSION.FNB_VIEW]: [
    "platform_super_admin", "club_admin", "fb_manager", "stand_manager",
    "kitchen_prep_staff", "executive_viewer",
  ],
  [PERMISSION.FNB_MANAGE]: [
    "platform_super_admin", "club_admin", "fb_manager",
  ],

  // ── Loyalty ───────────────────────────────────────────────────────────
  [PERMISSION.LOYALTY_VIEW]: [
    "platform_super_admin", "club_admin", "loyalty_manager", "support_agent",
    "executive_viewer",
  ],
  [PERMISSION.LOYALTY_MANAGE]: [
    "platform_super_admin", "club_admin", "loyalty_manager",
  ],
  [PERMISSION.LOYALTY_ADJUST]: [
    "platform_super_admin", "club_admin", "loyalty_manager", "support_manager",
  ],

  // ── Campaigns ─────────────────────────────────────────────────────────
  [PERMISSION.CAMPAIGNS_VIEW]: [
    "platform_super_admin", "club_admin", "marketing_manager",
    "cdp_data_analyst", "executive_viewer",
  ],
  [PERMISSION.CAMPAIGNS_CREATE]: [
    "platform_super_admin", "club_admin", "marketing_manager",
  ],
  [PERMISSION.CAMPAIGNS_SEND]: [
    "platform_super_admin", "club_admin", "marketing_manager",
  ],

  // ── RBAC ──────────────────────────────────────────────────────────────
  [PERMISSION.RBAC_VIEW_ROLES]: [
    "platform_super_admin", "club_admin", "module_admin", "auditor",
  ],
  [PERMISSION.RBAC_MANAGE_ROLES]: [
    "platform_super_admin", "club_admin",
  ],
  [PERMISSION.RBAC_OVERRIDE_PERMISSIONS]: [
    "platform_super_admin", "club_admin",
  ],

  // ── Labels ────────────────────────────────────────────────────────────
  [PERMISSION.LABELS_VIEW]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst", "marketing_manager",
    "support_manager",
  ],
  [PERMISSION.LABELS_MANAGE]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst", "marketing_manager",
  ],

  // ── Social ────────────────────────────────────────────────────────────
  [PERMISSION.SOCIAL_VIEW]: [
    "platform_super_admin", "club_admin", "marketing_manager",
    "cdp_data_analyst", "executive_viewer",
  ],
  [PERMISSION.SOCIAL_MANAGE]: [
    "platform_super_admin", "club_admin", "marketing_manager",
  ],

  // ── AI ────────────────────────────────────────────────────────────────
  [PERMISSION.AI_INSIGHTS_VIEW]: [
    "platform_super_admin", "club_admin", "cdp_data_analyst",
    "marketing_manager", "executive_viewer",
  ],
  [PERMISSION.AI_CHATBOT]: [
    "platform_super_admin", "club_admin", "module_admin",
    "cdp_data_analyst", "marketing_manager", "support_manager", "support_agent",
  ],
};

/**
 * Check whether a role (or list of roles) has a given permission.
 * Also applies per-user overrides: { allow: ['p1'], deny: ['p2'] }
 */
export function hasPermission(roleCodes, permissionKey, overrides = {}) {
  const roles = Array.isArray(roleCodes) ? roleCodes : [roleCodes];

  if (overrides.deny?.includes(permissionKey)) return false;
  if (overrides.allow?.includes(permissionKey)) return true;

  const allowedRoles = PERMISSION_MATRIX[permissionKey] ?? [];
  return roles.some((r) => allowedRoles.includes(r));
}

/**
 * Get all permissions for a set of roles (+ overrides).
 */
export function getEffectivePermissions(roleCodes, overrides = {}) {
  const roles = Array.isArray(roleCodes) ? roleCodes : [roleCodes];
  const base = Object.keys(PERMISSION_MATRIX).filter((p) =>
    (PERMISSION_MATRIX[p] ?? []).some((r) => roles.includes(r))
  );
  const set = new Set(base);
  (overrides.allow ?? []).forEach((p) => set.add(p));
  (overrides.deny ?? []).forEach((p) => set.delete(p));
  return [...set];
}
