/**
 * FanBox role definitions — mirrors backend/src/lib/fanboxRoles.js
 */
export const FANBOX_ROLES = [
  {
    code: "fanbox_admin",
    name: "Administrator",
    description: "Full access, including account management.",
  },
  {
    code: "fanbox_manager",
    name: "Manager",
    description: "Dashboard, fans, business, campaigns, and projects.",
  },
  {
    code: "fanbox_analyst",
    name: "Analyst",
    description: "Fans, intelligence, and business reporting.",
  },
  {
    code: "fanbox_marketer",
    name: "Marketer",
    description: "Campaigns, digital projects, and segmentation.",
  },
  {
    code: "fanbox_viewer",
    name: "Viewer",
    description: "Read-only dashboard access.",
  },
];

export const FANBOX_ROLE_MAP = Object.fromEntries(FANBOX_ROLES.map((r) => [r.code, r]));
