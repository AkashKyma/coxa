/**
 * Scope at which a role applies. Permissions will be layered on top later.
 */
export var RoleScope;
(function (RoleScope) {
    /** Platform-wide (multi-tenant SaaS operator) */
    RoleScope["Platform"] = "platform";
    /** Single club / tenant */
    RoleScope["Club"] = "club";
    /** Assigned business module (ticketing, retail, F&B, etc.) */
    RoleScope["Module"] = "module";
    /** Assigned location (store, stand, gate, warehouse) */
    RoleScope["Location"] = "location";
    /** Own vendor organization only */
    RoleScope["Vendor"] = "vendor";
    /** Self only (fan/member) */
    RoleScope["Self"] = "self";
    /** Privacy, security, audit */
    RoleScope["Privacy"] = "privacy";
    /** Technical integrations */
    RoleScope["Integration"] = "integration";
    /** Read-only audit / compliance */
    RoleScope["Audit"] = "audit";
})(RoleScope || (RoleScope = {}));
/**
 * Logical grouping for admin UI, seed scripts, and future permission bundles.
 */
export var RoleCategory;
(function (RoleCategory) {
    RoleCategory["Platform"] = "platform";
    RoleCategory["Administration"] = "administration";
    RoleCategory["Security"] = "security";
    RoleCategory["Finance"] = "finance";
    RoleCategory["Support"] = "support";
    RoleCategory["Data"] = "data";
    RoleCategory["Marketing"] = "marketing";
    RoleCategory["Ticketing"] = "ticketing";
    RoleCategory["Operations"] = "operations";
    RoleCategory["Commerce"] = "commerce";
    RoleCategory["Marketplace"] = "marketplace";
    RoleCategory["Fan"] = "fan";
})(RoleCategory || (RoleCategory = {}));
/**
 * Stable role identifiers used in JWT claims, DB records, and API checks.
 * Permissions are intentionally NOT defined here — only roles.
 */
export var RoleCode;
(function (RoleCode) {
    RoleCode["PlatformSuperAdmin"] = "platform_super_admin";
    RoleCode["ClubAdmin"] = "club_admin";
    RoleCode["ModuleAdmin"] = "module_admin";
    RoleCode["SecurityComplianceAdmin"] = "security_compliance_admin";
    RoleCode["Auditor"] = "auditor";
    RoleCode["IntegrationDeveloper"] = "integration_developer";
    RoleCode["ExecutiveViewer"] = "executive_viewer";
    RoleCode["FinanceManager"] = "finance_manager";
    RoleCode["SupportManager"] = "support_manager";
    RoleCode["SupportAgent"] = "support_agent";
    RoleCode["CdpDataAnalyst"] = "cdp_data_analyst";
    RoleCode["MarketingManager"] = "marketing_manager";
    RoleCode["LoyaltyManager"] = "loyalty_manager";
    RoleCode["SponsorPartnerManager"] = "sponsor_partner_manager";
    RoleCode["TicketingManager"] = "ticketing_manager";
    RoleCode["MembershipManager"] = "membership_manager";
    RoleCode["BoxOfficeOperator"] = "box_office_operator";
    RoleCode["GateSupervisor"] = "gate_supervisor";
    RoleCode["GateOperator"] = "gate_operator";
    RoleCode["RetailManager"] = "retail_manager";
    RoleCode["StoreManager"] = "store_manager";
    RoleCode["PosCashier"] = "pos_cashier";
    RoleCode["WarehouseInventoryManager"] = "warehouse_inventory_manager";
    RoleCode["FbManager"] = "fb_manager";
    RoleCode["StandManager"] = "stand_manager";
    RoleCode["KitchenPrepStaff"] = "kitchen_prep_staff";
    RoleCode["MarketplaceManager"] = "marketplace_manager";
    RoleCode["VendorAdmin"] = "vendor_admin";
    RoleCode["VendorStaff"] = "vendor_staff";
    RoleCode["FanMember"] = "fan_member";
})(RoleCode || (RoleCode = {}));
//# sourceMappingURL=types.js.map