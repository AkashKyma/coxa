import { Router } from "express";
import { RoleCode } from "@coxa/rbac";
import { RoleAssignment } from "../models/RoleAssignment.js";
import { User } from "../models/User.js";

const router = Router();

router.get("/users/:userId/roles", async (req, res, next) => {
  try {
    const assignments = await RoleAssignment.find({
      tenantId: req.ctx.tenantId,
      userId: req.params.userId,
      status: { $ne: "revoked" },
    }).sort({ createdAt: -1 });

    res.json({
      data: assignments,
      total: assignments.length,
      tenantId: req.ctx.tenantId,
      userId: req.params.userId,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/users/:userId/roles", async (req, res, next) => {
  try {
    const { roleCode, moduleCode, locationId, vendorId } = req.body;

    if (!roleCode || !Object.values(RoleCode).includes(roleCode)) {
      return res.status(400).json({
        code: "INVALID_ROLE",
        message: "roleCode is required and must be a valid RoleCode",
      });
    }

    const user = await User.findOne({
      _id: req.params.userId,
      tenantId: req.ctx.tenantId,
    });
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found" });
    }

    const assignment = await RoleAssignment.create({
      tenantId: req.ctx.tenantId,
      userId: req.params.userId,
      roleCode,
      moduleCode,
      locationId,
      vendorId,
      assignedBy: req.ctx.userId,
    });

    res.status(201).json({ data: assignment });
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:userId/roles/:assignmentId", async (req, res, next) => {
  try {
    const assignment = await RoleAssignment.findOneAndUpdate(
      {
        _id: req.params.assignmentId,
        tenantId: req.ctx.tenantId,
        userId: req.params.userId,
      },
      { status: "revoked", revokedAt: new Date() },
      { new: true },
    );

    if (!assignment) {
      return res.status(404).json({
        code: "ASSIGNMENT_NOT_FOUND",
        message: "Role assignment not found",
      });
    }

    res.json({ data: assignment });
  } catch (err) {
    next(err);
  }
});

export default router;
