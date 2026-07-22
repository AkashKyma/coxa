/** FanBox module keys — aligned with backend fanboxRoles.js */
export const MODULE = {
  FANS: "fans",
  BUSINESS: "business",
  PROJECTS: "projects",
  INTELLIGENCE: "intelligence",
  CAMPAIGNS: "campaigns",
  CONTROL: "control",
};

const ROLE_MODULE_MAP = {
  fanbox_admin: Object.values(MODULE),
  fanbox_manager: [MODULE.FANS, MODULE.BUSINESS, MODULE.PROJECTS, MODULE.INTELLIGENCE, MODULE.CAMPAIGNS],
  fanbox_analyst: [MODULE.FANS, MODULE.INTELLIGENCE, MODULE.BUSINESS],
  fanbox_marketer: [MODULE.FANS, MODULE.INTELLIGENCE, MODULE.CAMPAIGNS, MODULE.PROJECTS],
  fanbox_viewer: [MODULE.FANS],
};

export function getAllowedModules(role, moduleAccessOverride = []) {
  if (Array.isArray(moduleAccessOverride) && moduleAccessOverride.length > 0) {
    return new Set(moduleAccessOverride);
  }
  return new Set(ROLE_MODULE_MAP[role] ?? []);
}

import { useMemo } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export function usePermissions() {
  const { membership } = useAuth();
  const role = membership?.role ?? null;
  const moduleAccess = membership?.moduleAccess ?? [];

  const allowedModules = useMemo(
    () => getAllowedModules(role, moduleAccess),
    [role, moduleAccess],
  );

  return {
    can: (moduleKey) => allowedModules.has(moduleKey),
    allowedModules,
    role,
    isAdmin: role === "fanbox_admin",
    canManageStaff: role === "fanbox_admin",
  };
}
