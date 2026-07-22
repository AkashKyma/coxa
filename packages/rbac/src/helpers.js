import { ALL_ROLE_CODES, ROLE_REGISTRY, STAFF_ROLE_CODES, } from "./roles.js";
import { RoleScope, } from "./types.js";
export class RoleNotFoundError extends Error {
    roleCode;
    constructor(roleCode) {
        super(`Role not found: ${roleCode}`);
        this.roleCode = roleCode;
        this.name = "RoleNotFoundError";
    }
}
/** Get role definition by code; throws if unknown */
export function getRoleDefinition(roleCode) {
    const definition = ROLE_REGISTRY[roleCode];
    if (!definition) {
        throw new RoleNotFoundError(roleCode);
    }
    return definition;
}
/** Safe lookup — returns undefined for unknown codes (e.g. legacy JWT claims) */
export function findRoleDefinition(roleCode) {
    return ROLE_REGISTRY[roleCode];
}
export function isValidRoleCode(value) {
    return ALL_ROLE_CODES.includes(value);
}
export function listRoles(filter) {
    let roles = Object.values(ROLE_REGISTRY);
    if (filter?.category) {
        roles = roles.filter((r) => r.category === filter.category);
    }
    if (filter?.scope) {
        roles = roles.filter((r) => r.scope === filter.scope);
    }
    if (filter?.staffOnly) {
        roles = roles.filter((r) => r.isStaff);
    }
    return roles.sort((a, b) => a.name.localeCompare(b.name));
}
export function listStaffRoles() {
    return STAFF_ROLE_CODES.map((code) => ROLE_REGISTRY[code]).sort((a, b) => a.name.localeCompare(b.name));
}
/** Active role codes for a principal */
export function getActiveRoleCodes(principal) {
    return principal.roles
        .filter((a) => a.status === "active")
        .map((a) => a.roleCode);
}
/** Check if principal has at least one of the given roles (active only) */
export function hasAnyRole(principal, ...roleCodes) {
    const active = new Set(getActiveRoleCodes(principal));
    return roleCodes.some((code) => active.has(code));
}
/** Check if principal has all of the given roles (active only) */
export function hasAllRoles(principal, ...roleCodes) {
    const active = new Set(getActiveRoleCodes(principal));
    return roleCodes.every((code) => active.has(code));
}
/** Filter assignments to active only, optionally by scope */
export function getActiveAssignments(principal, scope) {
    return principal.roles.filter((a) => a.status === "active" &&
        (scope === undefined || ROLE_REGISTRY[a.roleCode]?.scope === scope));
}
/** Whether assignment is valid for tenant + optional module/location/vendor context */
export function isAssignmentInScope(assignment, context) {
    if (assignment.status !== "active")
        return false;
    if (assignment.tenantId !== context.tenantId)
        return false;
    const definition = findRoleDefinition(assignment.roleCode);
    if (!definition)
        return false;
    switch (definition.scope) {
        case RoleScope.Platform:
            return true;
        case RoleScope.Club:
        case RoleScope.Privacy:
        case RoleScope.Audit:
        case RoleScope.Integration:
            return true;
        case RoleScope.Module:
            return !context.moduleCode || assignment.moduleCode === context.moduleCode;
        case RoleScope.Location:
            return !context.locationId || assignment.locationId === context.locationId;
        case RoleScope.Vendor:
            return !context.vendorId || assignment.vendorId === context.vendorId;
        case RoleScope.Self:
            return true;
        default:
            return false;
    }
}
/** Serialize roles for JWT / session claims (codes only — no permissions yet) */
export function toRoleClaims(principal) {
    return {
        tenantId: principal.tenantId,
        userId: principal.userId,
        accountType: principal.accountType,
        roles: getActiveAssignments(principal).map((a) => ({
            code: a.roleCode,
            ...(a.moduleCode && { moduleCode: a.moduleCode }),
            ...(a.locationId && { locationId: a.locationId }),
            ...(a.vendorId && { vendorId: a.vendorId }),
        })),
    };
}
//# sourceMappingURL=helpers.js.map