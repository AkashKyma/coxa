export { RoleScope, RoleCategory, RoleCode, } from "./types.js";
export { ROLE_REGISTRY, ALL_ROLE_CODES, STAFF_ROLE_CODES, MVP_SEED_ROLE_CODES, } from "./roles.js";
export { RoleNotFoundError, getRoleDefinition, findRoleDefinition, isValidRoleCode, listRoles, listStaffRoles, getActiveRoleCodes, hasAnyRole, hasAllRoles, getActiveAssignments, isAssignmentInScope, toRoleClaims, } from "./helpers.js";
export { PERMISSION, PERMISSION_MATRIX, hasPermission, getEffectivePermissions, } from "./permissions.js";
//# sourceMappingURL=index.js.map