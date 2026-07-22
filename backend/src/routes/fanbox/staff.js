import { Router } from "express";
import { User } from "../../models/User.js";
import { FanboxStaff } from "../../models/FanboxStaff.js";
import { isValidFanboxRole } from "../../lib/fanboxRoles.js";
import { requireFanboxAuth, requireFanboxStaffManager } from "../../middleware/requireFanboxAuth.js";

const router = Router();

router.use(requireFanboxAuth);

router.get("/", requireFanboxStaffManager, async (req, res, next) => {
  try {
    const { clubId } = req;
    const records = await FanboxStaff.find({ clubId, status: { $in: ["active", "invited"] } })
      .populate("userId")
      .sort({ createdAt: -1 });

    res.json({
      data: {
        staff: records.map((s) => ({
          staffId: s._id,
          user: s.userId,
          role: s.role,
          moduleAccess: s.moduleAccess,
          status: s.status,
          joinedAt: s.createdAt,
        })),
      },
      total: records.length,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireFanboxStaffManager, async (req, res, next) => {
  try {
    const { clubId, user: inviter } = req;
    const { fullName, email, role, password, jobTitle, moduleAccess } = req.body ?? {};

    if (!email || !role) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "email and role are required" });
    }

    if (!isValidFanboxRole(role)) {
      return res.status(400).json({ code: "INVALID_ROLE", message: `Invalid FanBox role: ${role}` });
    }

    let staffUser = await User.findOne({ email: email.toLowerCase() });
    let created = false;

    if (!staffUser) {
      if (!fullName) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "fullName is required for new users" });
      }
      const tempPassword = password ?? `${Math.random().toString(36).slice(-8)}Ax1!`;
      if (tempPassword.length < 8) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "password must be at least 8 characters" });
      }
      const passwordHash = await User.hashPassword(tempPassword);
      staffUser = await User.create({
        fullName,
        email: email.toLowerCase(),
        passwordHash,
        jobTitle,
      });
      created = true;
    }

    const existing = await FanboxStaff.findOne({ clubId, userId: staffUser._id });
    let record;
    if (existing) {
      existing.role = role;
      existing.status = "active";
      if (Array.isArray(moduleAccess)) existing.moduleAccess = moduleAccess;
      await existing.save();
      record = existing;
    } else {
      record = await FanboxStaff.create({
        clubId,
        userId: staffUser._id,
        role,
        moduleAccess: Array.isArray(moduleAccess) ? moduleAccess : [],
        invitedBy: inviter._id,
        status: "active",
      });
    }

    res.status(created ? 201 : 200).json({
      data: {
        staffId: record._id,
        user: staffUser,
        role: record.role,
        moduleAccess: record.moduleAccess,
        created,
      },
      message: created ? "Usuário criado com acesso FanBox" : "Acesso FanBox atualizado",
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:staffId", requireFanboxStaffManager, async (req, res, next) => {
  try {
    const { clubId } = req;
    const { role, moduleAccess, status } = req.body ?? {};

    const record = await FanboxStaff.findOne({ _id: req.params.staffId, clubId });
    if (!record) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Staff member not found" });
    }

    if (role !== undefined) {
      if (!isValidFanboxRole(role)) {
        return res.status(400).json({ code: "INVALID_ROLE", message: `Invalid FanBox role: ${role}` });
      }
      record.role = role;
    }
    if (Array.isArray(moduleAccess)) record.moduleAccess = moduleAccess;
    if (status && ["active", "suspended"].includes(status)) record.status = status;

    await record.save();

    res.json({
      data: { staffId: record._id, role: record.role, moduleAccess: record.moduleAccess, status: record.status },
      message: "Staff updated",
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:staffId", requireFanboxStaffManager, async (req, res, next) => {
  try {
    const { clubId, user } = req;
    const record = await FanboxStaff.findOne({ _id: req.params.staffId, clubId });
    if (!record) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Staff member not found" });
    }

    if (record.userId.toString() === user._id.toString()) {
      return res.status(400).json({ code: "CANNOT_REMOVE_SELF", message: "Cannot remove your own FanBox access" });
    }

    record.status = "removed";
    await record.save();

    res.json({ message: "FanBox access revoked" });
  } catch (err) {
    next(err);
  }
});

export default router;
