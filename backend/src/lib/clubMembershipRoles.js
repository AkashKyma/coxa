import { RoleCode, STAFF_ROLE_CODES } from "@coxa/rbac";

/** Legacy roles kept for existing records and seed data */
export const LEGACY_CLUB_ROLES = ["owner", "admin", "member"];

/** Every value allowed on ClubMembership.role */
export const CLUB_MEMBERSHIP_ROLE_CODES = [
  ...LEGACY_CLUB_ROLES,
  ...STAFF_ROLE_CODES.filter((code) => code !== RoleCode.FanMember),
];

/** Roles that may invite, update, or remove club staff */
export const MEMBER_MANAGER_ROLES = [
  "owner",
  "admin",
  RoleCode.ClubAdmin,
  RoleCode.ModuleAdmin,
  RoleCode.PlatformSuperAdmin,
  RoleCode.SupportManager,
  RoleCode.RetailManager,
];

export function isValidClubMembershipRole(role) {
  return typeof role === "string" && CLUB_MEMBERSHIP_ROLE_CODES.includes(role);
}

/** Roles assignable via invite or role change (owner is reserved for club creation) */
export function isAssignableClubRole(role) {
  if (!role || role === "owner") return false;
  if (role === RoleCode.FanMember) return false;
  return isValidClubMembershipRole(role);
}

export function canManageClubMembers(role) {
  return typeof role === "string" && MEMBER_MANAGER_ROLES.includes(role);
}
