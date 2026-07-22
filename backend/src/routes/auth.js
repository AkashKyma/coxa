import { Router } from "express";
import { User } from "../models/User.js";
import { Club } from "../models/Club.js";
import { ClubMembership } from "../models/ClubMembership.js";
import { FanProfile } from "../models/FanProfile.js";
import { FanboxStaff } from "../models/FanboxStaff.js";
import { TenantConfig } from "../models/TenantConfig.js";
import { signToken } from "../config/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { publishEvent, identifyFan } from "../services/cdp/cdpEventService.js";
import { createMembership } from "../services/fanMembershipService.js";
import { redeemReferralCode } from "../services/referralService.js";
import { sendPasswordResetEmail, sendVerifyEmailMessage } from "../services/emailService.js";
import crypto from "crypto";

const router = Router();

// Token TTL constants
const RESET_TOKEN_TTL_MS  = 60 * 60 * 1000;       // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours

/* ── helpers ───────────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ── POST /api/v1/auth/signup ──────────────────────── */
/**
 * Step 1: Create user account + club (organization).
 * Body: { fullName, email, password, phone?, jobTitle?,
 *         clubName, country, city, sport?, stadiumName?, website?, size? }
 */
router.post("/signup", async (req, res, next) => {
  try {
    const {
      fullName, email, password, phone, jobTitle,
      clubName, country, city, sport, stadiumName, website, size,
    } = req.body;

    // Validate required
    const missing = [];
    if (!fullName) missing.push("fullName");
    if (!email) missing.push("email");
    if (!password) missing.push("password");
    if (!clubName) missing.push("clubName");
    if (!country) missing.push("country");
    if (!city) missing.push("city");
    if (missing.length) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: `Missing: ${missing.join(", ")}` });
    }

    if (password.length < 8) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" });
    }

    // Unique email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ code: "EMAIL_TAKEN", message: "Email already in use" });
    }

    // Unique slug for club
    const baseSlug = slugify(clubName);
    let slug = baseSlug;
    let attempt = 1;
    while (await Club.findOne({ slug })) {
      slug = `${baseSlug}-${attempt++}`;
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ fullName, email, passwordHash, phone, jobTitle });

    const club = await Club.create({
      name: clubName, slug, country, city,
      sport: sport ?? "Football",
      stadiumName, website,
      size: size ?? "medium",
      ownerId: user._id,
    });

    await ClubMembership.create({
      clubId: club._id,
      userId: user._id,
      role: "owner",
      status: "active",
    });

    // Auto-provision Fanbox access for the club owner
    await FanboxStaff.create({
      clubId: club._id,
      userId: user._id,
      role: "fanbox_admin",
      status: "active",
      moduleAccess: [],
    });

    // Auto-provision TenantConfig with all modules enabled
    await TenantConfig.create({
      tenantId: club._id.toString(),
      clubName: clubName,
      enabledModules: ["retail", "cdp", "loyalty", "personalization", "ticketing", "membership", "fanbox"],
      currency: "BRL",
      timezone: "America/Sao_Paulo",
    });

    const token = signToken({ userId: user._id.toString(), clubId: club._id.toString() });

    res.status(201).json({
      data: { user, club, token },
      message: "Account and club created",
    });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/login ───────────────────────── */
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
      return res.status(403).json({ code: "ACCOUNT_INACTIVE", message: "Account is not active" });
    }

    // Find user's clubs
    const memberships = await ClubMembership.find({ userId: user._id, status: "active" })
      .populate("clubId");

    if (!memberships.length) {
      return res.status(403).json({ code: "NO_CLUB", message: "No active club found for this user" });
    }

    // Use first active club (or later allow user to choose)
    const membership = memberships[0];
    const club = membership.clubId;

    const token = signToken({
      userId: user._id.toString(),
      clubId: club._id.toString(),
    });

    res.json({
      data: {
        user,
        club,
        membership: { role: membership.role, moduleAccess: membership.moduleAccess },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/fan/login ───────────────────── */
router.post("/fan/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }

    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
    let fanProfile = await FanProfile.findOne({ tenantId, userId: user._id, status: "active" });
    // Fallback: any active fan profile for this user (tenant mismatch tolerance)
    if (!fanProfile) {
      fanProfile = await FanProfile.findOne({ userId: user._id, status: "active" }).sort({ createdAt: -1 });
    }

    if (!fanProfile) {
      return res.status(403).json({
        code: "FAN_PROFILE_NOT_FOUND",
        message: "No fan profile linked to this account. Use staff sign-in or create a fan account.",
      });
    }

    const token = signToken({ userId: user._id.toString(), accountType: "fan" });

    identifyFan({
      tenantId,
      fanProfileId: fanProfile._id,
      traits: {
        email: fanProfile.email,
        name: fanProfile.fullName,
        memberId: fanProfile.memberId,
        lastLoginAt: new Date().toISOString(),
      },
    });

    res.json({ data: { user, fanProfile, token } });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/fan/signup ─────────────────── */
router.post("/fan/signup", async (req, res, next) => {
  try {
    const { fullName, email, password, phone, memberId, onboardingPlanCode, referralCode } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "fullName, email and password are required",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Password must be at least 8 characters",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ code: "EMAIL_TAKEN", message: "Email already in use" });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ fullName, email: email.toLowerCase(), passwordHash, phone });

    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
    const fanProfile = await FanProfile.create({
      tenantId,
      fanId: `fan-${email.split("@")[0]}-${Date.now().toString(36)}`,
      fullName,
      email: email.toLowerCase(),
      phone,
      userId: user._id,
      memberId: memberId || undefined,
      status: "active",
    });

    await publishEvent({
      tenantId,
      eventName: "fan.registered",
      source: "fan_auth",
      fanProfileId: fanProfile._id,
      idempotencyKey: `fan-register-${fanProfile._id.toString()}`,
      payload: { email: fanProfile.email, memberId: fanProfile.memberId },
    });

    identifyFan({
      tenantId,
      fanProfileId: fanProfile._id,
      traits: {
        email: fanProfile.email,
        name: fanProfile.fullName,
        memberId: fanProfile.memberId,
        createdAt: fanProfile.createdAt,
      },
    });

    // Optionally create membership if the fan chose a plan during signup
    if (onboardingPlanCode) {
      try {
        await createMembership({
          tenantId,
          fanProfileId: fanProfile._id,
          planCode: onboardingPlanCode,
          paymentFrequency: "monthly",
          paymentMethod: "stub",
          idempotencyKey: `onboarding-membership-${fanProfile._id.toString()}`,
        });
      } catch {
        // Non-fatal: account is created even if plan is unavailable
      }
    }

    // Optionally redeem a referral code
    if (referralCode?.trim()) {
      try {
        await redeemReferralCode(tenantId, fanProfile._id, referralCode.trim().toUpperCase());
      } catch {
        // Non-fatal
      }
    }

    const token = signToken({ userId: user._id.toString(), accountType: "fan" });

    // Send verification email (non-blocking — don't fail signup if email fails)
    try {
      const verifyToken = crypto.randomBytes(32).toString("hex");
      await User.updateOne({ _id: user._id }, {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      });
      sendVerifyEmailMessage({ to: user.email, token: verifyToken }).catch((e) =>
        console.error("[auth] verify email send failed:", e.message)
      );
    } catch {
      // Non-fatal
    }

    res.status(201).json({ data: { user, fanProfile, token }, message: "Fan account created" });
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/v1/auth/fan/me ───────────────────────── */
router.get("/fan/me", requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
    let fanProfile = await FanProfile.findOne({ tenantId, userId: req.user._id, status: "active" });

    // Fallback: find any active fan profile for this user if tenantId doesn't match
    // This handles the case where fan-dashboard VITE_TENANT_ID differs from the profile's tenantId
    if (!fanProfile) {
      fanProfile = await FanProfile.findOne({ userId: req.user._id, status: "active" }).sort({ createdAt: -1 });
    }

    if (!fanProfile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }

    res.json({ data: { user: req.user, fanProfile } });
  } catch (err) {
    next(err);
  }
});

/* ── PATCH /api/v1/auth/fan/profile ─────────────────── */
router.patch("/fan/profile", requireAuth, async (req, res, next) => {
  try {
    const { fullName, phone, dateOfBirth, gender, address, favoritePlayer, jerseySize, preferredLanguage } = req.body;
    const tenantId = req.headers["x-tenant-id"] ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";

    let fanProfile = await FanProfile.findOne({ tenantId, userId: req.user._id, status: "active" });
    if (!fanProfile) {
      fanProfile = await FanProfile.findOne({ userId: req.user._id, status: "active" }).sort({ createdAt: -1 });
    }
    if (!fanProfile) {
      return res.status(404).json({ code: "FAN_NOT_FOUND", message: "Fan profile not found" });
    }

    if (fullName !== undefined) fanProfile.fullName = fullName.trim();
    if (phone !== undefined) fanProfile.phone = phone;
    if (dateOfBirth !== undefined) fanProfile.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) fanProfile.gender = gender;
    if (address !== undefined) fanProfile.address = { ...fanProfile.address?.toObject?.() ?? fanProfile.address ?? {}, ...address };
    if (favoritePlayer !== undefined) fanProfile.favoritePlayer = favoritePlayer;
    if (jerseySize !== undefined) fanProfile.jerseySize = jerseySize || undefined;
    if (preferredLanguage !== undefined) fanProfile.preferredLanguage = preferredLanguage;

    await fanProfile.save();
    res.json({ data: fanProfile });
  } catch (err) {
    next(err);
  }
});
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const memberships = await ClubMembership.find({ userId: req.user._id, status: "active" })
      .populate("clubId");

    res.json({
      data: {
        user: req.user,
        memberships: memberships.map((m) => ({
          club: m.clubId,
          role: m.role,
          moduleAccess: m.moduleAccess,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/forgot-password ────────────── */
// Staff (club-auth) password reset
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await User.findOne({ email: email.toLowerCase() })
      .select("+passwordResetToken +passwordResetExpires");

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = token;
      user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();
      sendPasswordResetEmail({ to: user.email, token, isFan: false }).catch((e) =>
        console.error("[auth] reset email failed:", e.message)
      );
    }
    // Always 200 to prevent email enumeration
    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/reset-password ─────────────── */
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "token and password are required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } })
      .select("+passwordHash +passwordResetToken +passwordResetExpires");

    if (!user) return res.status(400).json({ code: "INVALID_TOKEN", message: "Reset token is invalid or has expired" });

    user.passwordHash = await User.hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/fan/forgot-password ─────────── */
// Fan (fan-auth) password reset — same logic, different email template
router.post("/fan/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await User.findOne({ email: email.toLowerCase() })
      .select("+passwordResetToken +passwordResetExpires");

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = token;
      user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();
      sendPasswordResetEmail({ to: user.email, token, isFan: true }).catch((e) =>
        console.error("[auth] fan reset email failed:", e.message)
      );
    }
    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/fan/reset-password ──────────── */
router.post("/fan/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "token and password are required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } })
      .select("+passwordHash +passwordResetToken +passwordResetExpires");

    if (!user) return res.status(400).json({ code: "INVALID_TOKEN", message: "Reset token is invalid or has expired" });

    user.passwordHash = await User.hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/auth/fan/verify-email ────────────── */
router.post("/fan/verify-email", async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    const user = await User.findOne({ emailVerifyToken: token, emailVerifyExpires: { $gt: new Date() } })
      .select("+emailVerifyToken +emailVerifyExpires");

    if (!user) return res.status(400).json({ code: "INVALID_TOKEN", message: "Verification link is invalid or has expired" });

    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
