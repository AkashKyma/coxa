/** Base fields required on every tenant-scoped record */
export interface TenantScoped {
  tenantId: string;
}

/** Standard audit metadata for mutable records */
export interface Auditable {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export type EntityStatus = "active" | "inactive" | "archived";

/** Account types supported by Identity service */
export type AccountType = "fan" | "staff" | "vendor" | "service";

export interface BaseEntity extends TenantScoped, Auditable {
  id: string;
  status: EntityStatus;
}

/** Request context propagated from API Gateway */
export interface RequestContext extends TenantScoped {
  requestId: string;
  userId?: string;
  locationId?: string;
  moduleCode?: string;
  vendorId?: string;
}

/** Standard API error shape */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Enabled business modules per tenant (Module 01) */
export type ModuleCode =
  | "platform_admin"
  | "identity"
  | "consent"
  | "cdp"
  | "ticketing"
  | "gate_access"
  | "checkout"
  | "retail"
  | "fnb"
  | "marketplace"
  | "loyalty"
  | "marketing"
  | "personalization"
  | "ai_concierge"
  | "reporting"
  | "integrations"
  | "fiscal"
  | "device_ops";
