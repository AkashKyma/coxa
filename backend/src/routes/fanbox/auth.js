import { Router } from "express";
import { User } from "../../models/User.js";
import { FanboxStaff } from "../../models/FanboxStaff.js";
import { signToken } from "../../config/jwt.js";
import { requireFanboxToken } from "../../middleware/requireFanboxAuth.js";
import { getFanboxModulesForRole } from "../../lib/fanboxRoles.js";

const router = Router();

/** POST /api/v1/auth/login */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ code: "ACCOUNT_INACTIVE", message: "Inactive account" });
    }

    const staffRecords = await FanboxStaff.find({ userId: user._id, status: "active" }).populate("clubId");
    if (!staffRecords.length) {
      return res.status(403).json({
        code: "NO_FANBOX_ACCESS",
        message: "This user does not have FanBox access. Contact an administrator.",
      });
    }

    const active = staffRecords[0];
    const club = active.clubId;

    const token = signToken({
      userId: user._id.toString(),
      clubId: club._id.toString(),
      accountType: "fanbox",
    });

    res.json({
      data: {
        user,
        club,
        staff: {
          role: active.role,
          moduleAccess: active.moduleAccess,
          staffId: active._id,
        },
        memberships: staffRecords.map((s) => ({
          club: s.clubId,
          role: s.role,
          moduleAccess: s.moduleAccess,
          staffId: s._id,
        })),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/auth/me */
router.get("/me", requireFanboxToken, async (req, res, next) => {
  try {
    const staffRecords = await FanboxStaff.find({ userId: req.user._id, status: "active" }).populate("clubId");

    res.json({
      data: {
        user: req.user,
        memberships: staffRecords.map((s) => ({
          club: s.clubId,
          role: s.role,
          moduleAccess: s.moduleAccess,
          staffId: s._id,
          modules: [...getFanboxModulesForRole(s.role, s.moduleAccess)],
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/auth/clubs */
router.get("/clubs", requireFanboxToken, async (req, res, next) => {
  try {
    const staffRecords = await FanboxStaff.find({ userId: req.user._id, status: "active" }).populate("clubId");

    res.json({
      data: {
        clubs: staffRecords.map((s) => ({
          club: s.clubId,
          role: s.role,
          moduleAccess: s.moduleAccess,
          staffId: s._id,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
