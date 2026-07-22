import { FanProfile } from "../models/FanProfile.js";

function generateFanId(email) {
  const local = email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 12);
  return `fan-${local}-${Date.now().toString(36).slice(-4)}`;
}

export async function findFanProfile(tenantId, { fanProfileId, fanId, email, userId }) {
  if (fanProfileId) {
    return FanProfile.findOne({ _id: fanProfileId, tenantId, status: "active" });
  }
  if (fanId) {
    return FanProfile.findOne({ tenantId, fanId, status: "active" });
  }
  if (email) {
    return FanProfile.findOne({ tenantId, email: email.toLowerCase(), status: "active" });
  }
  if (userId) {
    return FanProfile.findOne({ tenantId, userId, status: "active" });
  }
  return null;
}

export async function searchFanProfiles(tenantId, query, limit = 20) {
  const q = (query ?? "").trim();

  // No query → return all profiles for the tenant (up to limit)
  if (!q) {
    return FanProfile.find({ tenantId, status: "active" })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  const filter = {
    tenantId,
    status: "active",
    $or: [
      { email: { $regex: q, $options: "i" } },
      { fullName: { $regex: q, $options: "i" } },
      { fanId: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
    ],
  };

  if (/^[a-f\d]{24}$/i.test(q)) {
    filter.$or.push({ _id: q });
  }

  return FanProfile.find(filter).sort({ fullName: 1 }).limit(limit);
}

export async function getOrCreateFanProfile({
  tenantId,
  fullName,
  email,
  phone,
  userId,
  memberId,
}) {
  const normalizedEmail = email.toLowerCase().trim();
  let profile = await FanProfile.findOne({ tenantId, email: normalizedEmail });

  if (profile) {
    let changed = false;
    if (fullName && profile.fullName !== fullName) {
      profile.fullName = fullName;
      changed = true;
    }
    if (phone && profile.phone !== phone) {
      profile.phone = phone;
      changed = true;
    }
    if (userId && !profile.userId) {
      profile.userId = userId;
      changed = true;
    }
    if (memberId && profile.memberId !== memberId) {
      profile.memberId = memberId;
      changed = true;
    }
    if (changed) await profile.save();
    return { profile, created: false };
  }

  profile = await FanProfile.create({
    tenantId,
    fanId: generateFanId(normalizedEmail),
    fullName: fullName ?? normalizedEmail.split("@")[0],
    email: normalizedEmail,
    phone,
    userId,
    memberId,
    status: "active",
  });

  return { profile, created: true };
}

export function maskEmail(email) {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const masked = local.length <= 2 ? "**" : `${local[0]}***${local.slice(-1)}`;
  return `${masked}@${domain}`;
}

export function maskPhone(phone) {
  if (!phone || phone.length < 4) return "***";
  return `***${phone.slice(-4)}`;
}
