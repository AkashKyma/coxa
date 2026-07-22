import { Router } from "express";
import {
  RoleCategory,
  RoleScope,
  getRoleDefinition,
  isValidRoleCode,
  listRoles,
  listStaffRoles,
  MVP_SEED_ROLE_CODES,
  ROLE_REGISTRY,
} from "@coxa/rbac";

const router = Router();

router.get("/", (req, res) => {
  const { category, scope, staffOnly } = req.query;
  const roles = listRoles({
    category: category || undefined,
    scope: scope || undefined,
    staffOnly: staffOnly === "true",
  });
  res.json({ data: roles, total: roles.length, tenantId: req.ctx.tenantId });
});

router.get("/staff", (req, res) => {
  const roles = listStaffRoles();
  res.json({ data: roles, total: roles.length, tenantId: req.ctx.tenantId });
});

router.get("/seed", (_req, res) => {
  const roles = MVP_SEED_ROLE_CODES.map((code) => ROLE_REGISTRY[code]);
  res.json({ data: roles, roleCodes: MVP_SEED_ROLE_CODES });
});

router.get("/meta/scopes", (_req, res) => {
  res.json({ data: Object.values(RoleScope) });
});

router.get("/meta/categories", (_req, res) => {
  res.json({ data: Object.values(RoleCategory) });
});

router.get("/:code", (req, res) => {
  const { code } = req.params;
  if (!isValidRoleCode(code)) {
    return res.status(404).json({ code: "ROLE_NOT_FOUND", message: `Unknown role: ${code}` });
  }
  res.json({ data: getRoleDefinition(code) });
});

export default router;
