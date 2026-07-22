import { Router } from "express";
import { Club } from "../models/Club.js";
import { ClubMembership } from "../models/ClubMembership.js";
import { User } from "../models/User.js";
import { requireAuth, requireMemberManager } from "../middleware/requireAuth.js";
import { isAssignableClubRole } from "../lib/clubMembershipRoles.js";

const router = Router();

/* ── helpers ────────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ── GET /api/v1/clubs
 * Returns all clubs where the authenticated user has an active membership.
 * Used by the club-switcher UI.
 * ────────────────────────────────────────────────── */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const memberships = await ClubMembership.find({
      userId: req.user._id,
      status: "active",
    }).populate("clubId");

    const clubs = memberships.map((m) => ({
      club: m.clubId,
      role: m.role,
      moduleAccess: m.moduleAccess,
      membershipId: m._id,
    }));

    res.json({ data: { clubs } });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/clubs
 * Creates a new club and assigns the authenticated user as owner.
 * Body: { clubName, country, city, sport?, stadiumName?, website?, size? }
 * ────────────────────────────────────────────────── */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { clubName, country, city, sport, stadiumName, website, size } = req.body;

    const missing = [];
    if (!clubName) missing.push("clubName");
    if (!country) missing.push("country");
    if (!city) missing.push("city");
    if (missing.length) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: `Missing: ${missing.join(", ")}` });
    }

    const baseSlug = slugify(clubName);
    let slug = baseSlug;
    let attempt = 1;
    while (await Club.findOne({ slug })) {
      slug = `${baseSlug}-${attempt++}`;
    }

    const club = await Club.create({
      name: clubName, slug, country, city,
      sport: sport ?? "Football",
      stadiumName, website,
      size: size ?? "medium",
      ownerId: req.user._id,
    });

    const membership = await ClubMembership.create({
      clubId: club._id,
      userId: req.user._id,
      role: "owner",
      status: "active",
    });

    res.status(201).json({
      data: {
        club,
        role: membership.role,
        membershipId: membership._id,
      },
      message: "Club created",
    });
  } catch (err) {
    next(err);
  }
});

/* ── PATCH /api/v1/clubs/:clubId — update club profile ── */
router.patch("/:clubId", requireAuth, async (req, res, next) => {
  try {
    const { clubId } = req.params;
    const membership = await ClubMembership.findOne({ clubId, userId: req.user._id, status: "active" });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return res.status(403).json({ message: "Only club owners or admins can update club settings" });
    }

    const { name, country, city, sport, stadiumName, website } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (country) updates.country = country;
    if (city) updates.city = city;
    if (sport !== undefined) updates.sport = sport;
    if (stadiumName !== undefined) updates.stadiumName = stadiumName;
    if (website !== undefined) updates.website = website;

    const club = await Club.findByIdAndUpdate(clubId, { $set: updates }, { new: true });
    if (!club) return res.status(404).json({ message: "Club not found" });

    res.json({ data: club, message: "Club updated" });
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/v1/clubs/:clubId/members
 * Returns all active members of a specific club.
 * Caller must have an active membership to that club (enforced via X-Club-Id).
 * ────────────────────────────────────────────────── */
router.get("/:clubId/members", requireAuth, requireMemberManager, async (req, res, next) => {
  try {
    const { clubId } = req.params;

    // Ensure the caller belongs to this club
    if (req.clubId && req.clubId !== clubId) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Club context mismatch" });
    }

    const memberships = await ClubMembership.find({
      clubId,
      status: "active",
    }).populate("userId");

    const members = memberships.map((m) => ({
      user: m.userId,
      role: m.role,
      moduleAccess: m.moduleAccess,
      membershipId: m._id,
      joinedAt: m.createdAt,
    }));

    res.json({ data: { members } });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/v1/clubs/:clubId/members
 * Invite (or create) a staff user and add them to the club with the given role.
 * Body: { fullName, email, role, password?, jobTitle? }
 * - If a User with that email already exists → just add/update the membership.
 * - If no user exists → create one with a temporary password.
 * ────────────────────────────────────────────────── */
router.post("/:clubId/members", requireAuth, requireMemberManager, async (req, res, next) => {
  try {
    const { clubId } = req.params;
    const { fullName, email, role, password, jobTitle } = req.body ?? {};

    if (!email || !role) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "email and role are required" });
    }

    if (!isAssignableClubRole(role)) {
      return res.status(400).json({
        code: "INVALID_ROLE",
        message: `Role "${role}" is not a valid staff role for club membership`,
      });
    }

    // Verify the club exists and the caller belongs to it
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ code: "NOT_FOUND", message: "Club not found" });

    // Find or create the user
    let user = await User.findOne({ email: email.toLowerCase() });
    let created = false;

    if (!user) {
      if (!fullName) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "fullName is required for new users" });
      }
      const tempPassword = password ?? Math.random().toString(36).slice(-10) + "Ax1!";
      if (tempPassword.length < 8) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "password must be at least 8 characters" });
      }
      const passwordHash = await User.hashPassword(tempPassword);
      user = await User.create({ fullName, email: email.toLowerCase(), passwordHash, jobTitle });
      created = true;
    }

    // Upsert the membership
    const existing = await ClubMembership.findOne({ clubId, userId: user._id });
    let membership;
    if (existing) {
      existing.role = role;
      existing.status = "active";
      await existing.save();
      membership = existing;
    } else {
      membership = await ClubMembership.create({
        clubId,
        userId: user._id,
        role,
        status: "active",
      });
    }

    const userObj = user.toJSON ? user.toJSON() : user;
    res.status(created ? 201 : 200).json({
      data: {
        user: userObj,
        role: membership.role,
        membershipId: membership._id,
        created,
      },
      message: created ? "User created and added to club" : "Existing user added to club",
    });
  } catch (err) {
    next(err);
  }
});

/* ── PATCH /api/v1/clubs/:clubId/members/:membershipId
 * Update a member's role.
 * Body: { role }
 * ────────────────────────────────────────────────── */
router.patch("/:clubId/members/:membershipId", requireAuth, requireMemberManager, async (req, res, next) => {
  try {
    const { clubId, membershipId } = req.params;
    const { role } = req.body ?? {};

    if (!role) return res.status(400).json({ code: "VALIDATION_ERROR", message: "role is required" });

    if (!isAssignableClubRole(role)) {
      return res.status(400).json({
        code: "INVALID_ROLE",
        message: `Role "${role}" is not a valid staff role for club membership`,
      });
    }

    const membership = await ClubMembership.findOne({ _id: membershipId, clubId });
    if (!membership) return res.status(404).json({ code: "NOT_FOUND", message: "Membership not found" });

    membership.role = role;
    await membership.save();

    res.json({ data: { membershipId, role }, message: "Role updated" });
  } catch (err) {
    next(err);
  }
});

/* ── DELETE /api/v1/clubs/:clubId/members/:membershipId
 * Remove a member from the club (sets status inactive).
 * ────────────────────────────────────────────────── */
router.delete("/:clubId/members/:membershipId", requireAuth, requireMemberManager, async (req, res, next) => {
  try {
    const { clubId, membershipId } = req.params;

    const membership = await ClubMembership.findOne({ _id: membershipId, clubId });
    if (!membership) return res.status(404).json({ code: "NOT_FOUND", message: "Membership not found" });

    membership.status = "removed";
    await membership.save();

    res.json({ message: "Member removed from club" });
  } catch (err) {
    next(err);
  }
});

export default router;
