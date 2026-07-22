/** FanBox-specific staff roles (independent of club-dashboard RBAC). */

export const FANBOX_ROLE_CODES = [
  "fanbox_admin",
  "fanbox_manager",
  "fanbox_analyst",
  "fanbox_marketer",
  "fanbox_viewer",
];

export const FANBOX_MODULE = {
  FANS: "fans",
  BUSINESS: "business",
  PROJECTS: "projects",
  INTELLIGENCE: "intelligence",
  CAMPAIGNS: "campaigns",
  CONTROL: "control",
};

export const ALL_FANBOX_MODULES = Object.values(FANBOX_MODULE);

export const FANBOX_ROLE_DEFINITIONS = {
  fanbox_admin: {
    code: "fanbox_admin",
    name: "Administrador FanBox",
    description: "Acesso total ao FanBox, incluindo gestão de contas.",
    modules: ALL_FANBOX_MODULES,
    canManageStaff: true,
  },
  fanbox_manager: {
    code: "fanbox_manager",
    name: "Gerente FanBox",
    description: "Dashboard, fãs, negócios, campanhas e projetos digitais.",
    modules: [
      FANBOX_MODULE.FANS,
      FANBOX_MODULE.BUSINESS,
      FANBOX_MODULE.PROJECTS,
      FANBOX_MODULE.INTELLIGENCE,
      FANBOX_MODULE.CAMPAIGNS,
    ],
    canManageStaff: false,
  },
  fanbox_analyst: {
    code: "fanbox_analyst",
    name: "Analista",
    description: "Visualização de fãs, inteligência e relatórios de negócios.",
    modules: [FANBOX_MODULE.FANS, FANBOX_MODULE.INTELLIGENCE, FANBOX_MODULE.BUSINESS],
    canManageStaff: false,
  },
  fanbox_marketer: {
    code: "fanbox_marketer",
    name: "Marketing",
    description: "Campanhas, projetos digitais e segmentação.",
    modules: [
      FANBOX_MODULE.FANS,
      FANBOX_MODULE.INTELLIGENCE,
      FANBOX_MODULE.CAMPAIGNS,
      FANBOX_MODULE.PROJECTS,
    ],
    canManageStaff: false,
  },
  fanbox_viewer: {
    code: "fanbox_viewer",
    name: "Visualizador",
    description: "Somente leitura do dashboard e contadores.",
    modules: [FANBOX_MODULE.FANS],
    canManageStaff: false,
  },
};

export function isValidFanboxRole(role) {
  return typeof role === "string" && FANBOX_ROLE_CODES.includes(role);
}

export function isAssignableFanboxRole(role) {
  return isValidFanboxRole(role);
}

export function canManageFanboxStaff(role) {
  return role === "fanbox_admin";
}

export function getFanboxModulesForRole(role, moduleAccessOverride = []) {
  if (Array.isArray(moduleAccessOverride) && moduleAccessOverride.length > 0) {
    return new Set(moduleAccessOverride);
  }
  const def = FANBOX_ROLE_DEFINITIONS[role];
  return new Set(def?.modules ?? []);
}

export function fanboxRoleHasModule(role, moduleKey, moduleAccessOverride = []) {
  return getFanboxModulesForRole(role, moduleAccessOverride).has(moduleKey);
}
