/**
 * Universal Message Router
 *
 * Determines the best channel for a message, respecting:
 *   1. Fan channel preferences
 *   2. Quiet hours (per-tenant config)
 *   3. Frequency caps (per fan / channel / time window)
 *   4. Channel suppression (bounces, unsubscribes, complaints)
 *   5. Consent status
 *
 * Default channel cascade order:
 *   marketing:         whatsapp → email → push → sms → in_app
 *   transactional:     email → whatsapp → push → sms
 *   matchday_critical: push → whatsapp → email → sms
 *   system:            in_app → push → email
 */

import { MessageIntent } from "../models/MessageIntent.js";
import { QuietHoursConfig } from "../models/QuietHoursConfig.js";
import { FanChannelPreference } from "../models/FanChannelPreference.js";

const CHANNEL_CASCADE = {
  marketing:         ["whatsapp", "email", "push", "sms", "in_app"],
  transactional:     ["email", "whatsapp", "push", "sms"],
  matchday_critical: ["push", "whatsapp", "email", "sms"],
  system:            ["in_app", "push", "email"],
};

// Default frequency caps: max messages per 24-hour window
const DEFAULT_CAPS = {
  marketing:         3,
  transactional:     Infinity,
  matchday_critical: 5,
  system:            Infinity,
};

/**
 * Main routing entry point.
 *
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string|import("mongoose").Types.ObjectId} opts.fanId
 * @param {string} opts.intent         e.g. "nbo.offer_assigned"
 * @param {string} opts.category       transactional | marketing | matchday_critical | system
 * @param {object} [opts.payload]      { title, body, data, tokens }
 * @param {string} [opts.preferredChannel]  explicit override
 * @returns {Promise<{ routed: boolean, channel: string|null, messageIntentId: string, reason?: string }>}
 */
export async function routeMessage({ tenantId, fanId, intent, category, payload = {}, preferredChannel }) {
  // 1. Persist the intent document
  const intentDoc = await MessageIntent.create({
    tenantId,
    fanId,
    intent,
    category,
    payload,
    preferredChannel,
    status: "pending",
  });

  async function fail(status, reason) {
    intentDoc.status = status;
    intentDoc.failReason = reason;
    await intentDoc.save();
    return { routed: false, channel: null, messageIntentId: intentDoc._id.toString(), reason };
  }

  // 2. Quiet hours check
  const qh = await checkQuietHours(tenantId, category);
  if (qh.inQuietHours && !qh.exempted) {
    return fail("quiet_hours", "Message withheld — quiet hours active for this tenant");
  }

  // 3. Build cascade order
  let cascade = CHANNEL_CASCADE[category] ?? CHANNEL_CASCADE.marketing;
  if (preferredChannel) {
    cascade = [preferredChannel, ...cascade.filter((c) => c !== preferredChannel)];
  }

  // 4. Load fan preferences (fail-open if not found)
  let fanPrefs = null;
  try {
    fanPrefs = await FanChannelPreference.findOne({ tenantId, fanId }).lean();
  } catch {
    // Fail open — no prefs found is not a blocking error
  }

  // 5. Try each channel in cascade order
  for (const channel of cascade) {
    // 5a. Fan preference check
    if (fanPrefs?.preferences?.[channel]?.enabled === false) {
      continue;
    }

    // 5b. Frequency cap check
    const capResult = await checkFrequencyCap(tenantId, fanId, channel, category);
    if (!capResult.allowed) {
      continue;
    }

    // 5c. Channel suppression check
    const suppressed = await isChannelSuppressed(tenantId, fanId, channel);
    if (suppressed) {
      continue;
    }

    // 5d. Consent check — map channel to consent purpose
    const purpose = channelToPurpose(channel, category);
    const consented = await checkConsent(tenantId, fanId, purpose);
    if (!consented) {
      continue;
    }

    // 6. Channel selected — dispatch
    intentDoc.selectedChannel = channel;
    intentDoc.routedAt = new Date();

    const dispatchResult = await dispatch({ tenantId, fanId, channel, category, payload, intentDoc });
    if (dispatchResult.success) {
      intentDoc.status = "sent";
    } else if (dispatchResult.tryNext) {
      // Channel not configured / not implemented — keep trying cascade
      continue;
    } else {
      intentDoc.status = "failed";
      intentDoc.failReason = dispatchResult.error;
      await intentDoc.save();
      return { routed: false, channel, messageIntentId: intentDoc._id.toString(), reason: dispatchResult.error };
    }

    await intentDoc.save();
    return { routed: true, channel, messageIntentId: intentDoc._id.toString() };
  }

  // All channels exhausted
  return fail("suppressed", "All channels exhausted — suppressed, capped, or not consented");
}

// ─── Quiet Hours ─────────────────────────────────────────────────────────────

/**
 * @param {string} tenantId
 * @param {string} category
 * @returns {Promise<{ inQuietHours: boolean, exempted: boolean }>}
 */
export async function checkQuietHours(tenantId, category) {
  let config = null;
  try {
    config = await QuietHoursConfig.findOne({ tenantId }).lean();
  } catch {
    // Fail open
  }

  const enabled    = config?.enabled       ?? true;
  const startHour  = config?.startHour     ?? 22;
  const endHour    = config?.endHour       ?? 8;
  const timezone   = config?.timezone      ?? "America/Sao_Paulo";
  const exemptCats = config?.exemptCategories ?? ["matchday_critical", "transactional"];

  if (!enabled) return { inQuietHours: false, exempted: false };

  const exempted = exemptCats.includes(category);
  if (exempted) return { inQuietHours: false, exempted: true };

  const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
  const currentHour = nowInTz.getHours();

  let inQuietHours;
  if (startHour > endHour) {
    // Overnight window: e.g. 22:00–08:00
    inQuietHours = currentHour >= startHour || currentHour < endHour;
  } else {
    // Same-day window: e.g. 01:00–06:00
    inQuietHours = currentHour >= startHour && currentHour < endHour;
  }

  return { inQuietHours, exempted: false };
}

// ─── Frequency Cap ───────────────────────────────────────────────────────────

/**
 * @param {string} tenantId
 * @param {string|import("mongoose").Types.ObjectId} fanId
 * @param {string} channel
 * @param {string} category
 * @returns {Promise<{ allowed: boolean, reason: string|null }>}
 */
export async function checkFrequencyCap(tenantId, fanId, channel, category) {
  try {
    const { FrequencyCap } = await import("../models/FrequencyCap.js");
    const now = new Date();

    const cap = await FrequencyCap.findOne({
      tenantId,
      fanId,
      channel,
      category,
      windowEnd: { $gte: now },
    }).lean();

    if (!cap) return { allowed: true, reason: null };

    const maxAllowed = cap.maxAllowed ?? (DEFAULT_CAPS[category] ?? 3);
    if (cap.count >= maxAllowed) {
      return {
        allowed: false,
        reason: `Frequency cap reached: ${cap.count}/${maxAllowed} for ${channel}/${category}`,
      };
    }
    return { allowed: true, reason: null };
  } catch {
    // FrequencyCap model not available — fail open
    return { allowed: true, reason: null };
  }
}

// ─── Consent Check ───────────────────────────────────────────────────────────

/**
 * Returns true if the fan has granted consent for the given purpose,
 * or if ConsentRecord is not available (fail-open migration mode).
 *
 * @param {string} tenantId
 * @param {string|import("mongoose").Types.ObjectId} fanId
 * @param {string} purpose
 * @returns {Promise<boolean>}
 */
export async function checkConsent(tenantId, fanId, purpose) {
  try {
    const { ConsentRecord } = await import("../models/ConsentRecord.js");
    const record = await ConsentRecord.findOne({
      tenantId,
      fanId,
      purpose,
      status: "granted",
    }).lean();
    // If no record found we treat as not consented only for marketing-class purposes;
    // transactional and system purposes fail open so operational messages still flow.
    if (!record) {
      return ["transactional", "system"].some((p) => purpose.startsWith(p));
    }
    return true;
  } catch {
    // ConsentRecord model not available — fail open during migration
    return true;
  }
}

// ─── Channel Suppression ─────────────────────────────────────────────────────

/**
 * @returns {Promise<boolean>} true if the fan/channel combination is suppressed
 */
async function isChannelSuppressed(tenantId, fanId, channel) {
  try {
    const { ChannelSuppression } = await import("../models/ChannelSuppression.js");
    const record = await ChannelSuppression.findOne({ tenantId, fanId, channel }).lean();
    return !!record;
  } catch {
    return false;
  }
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

async function dispatch({ tenantId, fanId, channel, category, payload, intentDoc }) {
  switch (channel) {
    case "email": {
      try {
        const { sendTransactionalEmail } = await import("./emailService.js");
        const { FanProfile } = await import("../models/FanProfile.js");

        const fan = await FanProfile.findById(fanId).lean();
        if (!fan?.email) {
          return { success: false, tryNext: true, error: "Fan has no email address" };
        }
        if (fan.emailOptOut) {
          return { success: false, tryNext: true, error: "Fan has opted out of email" };
        }

        const result = await sendTransactionalEmail({
          tenantId,
          fanId,
          emailAddress: fan.email,
          templateSlug: payload.templateSlug ?? intentDoc.intent,
          tokens: payload.tokens ?? {},
        });

        if (!result || result.status === "failed") {
          // SES not configured or send failed — try next channel
          return { success: false, tryNext: true, error: result?.suppressedReason ?? "email send failed" };
        }
        return { success: true };
      } catch (err) {
        console.warn(`[messageRouter] email dispatch error: ${err.message}`);
        return { success: false, tryNext: true, error: err.message };
      }
    }

    default: {
      console.info(
        `[messageRouter] Channel "${channel}" not yet implemented for intent="${intentDoc.intent}" category="${category}" — trying next`,
      );
      return { success: false, tryNext: true, error: `${channel} not yet implemented` };
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function channelToPurpose(channel, category) {
  if (category === "transactional" || category === "system") return "transactional";
  switch (channel) {
    case "email":    return "email_marketing";
    case "sms":      return "sms";
    case "whatsapp": return "whatsapp";
    case "push":     return "push_notifications";
    case "in_app":   return "marketing";
    default:         return "marketing";
  }
}
