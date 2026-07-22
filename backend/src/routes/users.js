import { Router } from "express";
import { User } from "../models/User.js";
import { RoleAssignment } from "../models/RoleAssignment.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const filter = { tenantId: req.ctx.tenantId };
    if (req.query.accountType) filter.accountType = req.query.accountType;

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ data: users, total: users.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenantId: req.ctx.tenantId });
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found" });
    }

    const roles = await RoleAssignment.find({
      tenantId: req.ctx.tenantId,
      userId: user._id,
      status: { $ne: "revoked" },
    });

    res.json({ data: { user, roles } });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { email, name, accountType } = req.body;
    if (!email || !name || !accountType) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "email, name and accountType are required",
      });
    }

    const user = await User.create({
      tenantId: req.ctx.tenantId,
      email,
      name,
      accountType,
    });

    res.status(201).json({ data: user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ code: "DUPLICATE_EMAIL", message: "Email already exists" });
    }
    next(err);
  }
});

export default router;
