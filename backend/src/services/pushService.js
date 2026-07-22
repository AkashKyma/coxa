/**
 * pushService.js — Phase 2 Campaign Delivery
 *
 * Handles Web Push (browser) and FCM (mobile app) notifications.
 *
 * Web Push: uses web-push (VAPID) for fan-dashboard / fan-app browsers.
 * FCM: uses Firebase Admin SDK for React Native fan-app push tokens.
 *
 * Device tokens are stored on FanProfile.pushTokens[].
 * Set env vars:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL  (web push)
 *   FIREBASE_SERVICE_ACCOUNT_JSON                     (FCM)
 */

import { FanProfile } from "../models/FanProfile.js";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, FIREBASE_SERVICE_ACCOUNT_JSON, NODE_ENV } = process.env;

// ── Web Push (VAPID) ──────────────────────────────────────────────────────────
let webPush = null;
async function getWebPush() {
  if (webPush) return webPush;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    if (NODE_ENV !== "production") console.info("[push] VAPID keys not set — web push disabled");
    return null;
  }
  try {
    const mod = await import("web-push");
    webPush = mod.default ?? mod;
    webPush.setVapidDetails(
      VAPID_EMAIL ?? "mailto:noreply@coxa.live",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );
    return webPush;
  } catch {
    console.warn("[push] web-push package not installed — install with: npm i web-push");
    return null;
  }
}

// ── FCM Admin SDK ─────────────────────────────────────────────────────────────
let fcmApp = null;
async function getFcmMessaging() {
  if (fcmApp) return fcmApp;
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) return null;
  try {
    const admin = (await import("firebase-admin")).default;
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) });
    }
    fcmApp = admin.messaging();
    return fcmApp;
  } catch {
    console.warn("[push] firebase-admin not installed — FCM push disabled");
    return null;
  }
}

// ── Register / update device token ───────────────────────────────────────────
export async function registerPushToken({ fanProfileId, token, type, userAgent }) {
  await FanProfile.findByIdAndUpdate(
    fanProfileId,
    {
      $pull: { pushTokens: { token } },
    },
    { new: false },
  );
  await FanProfile.findByIdAndUpdate(
    fanProfileId,
    {
      $push: {
        pushTokens: {
          token,
          type: type ?? "web",
          userAgent: userAgent ?? null,
          registeredAt: new Date(),
        },
      },
    },
  );
}

export async function removePushToken({ fanProfileId, token }) {
  await FanProfile.findByIdAndUpdate(fanProfileId, { $pull: { pushTokens: { token } } });
}

// ── Send to a single fan ──────────────────────────────────────────────────────
export async function sendPushToFan({ fanProfileId, title, body, data = {}, url }) {
  const fan = await FanProfile.findById(fanProfileId).select("pushTokens");
  if (!fan?.pushTokens?.length) return { sent: 0 };

  const [wp, fcm] = await Promise.all([getWebPush(), getFcmMessaging()]);
  let sent = 0;
  const failures = [];

  for (const tokenEntry of fan.pushTokens) {
    try {
      if (tokenEntry.type === "web" && wp) {
        await wp.sendNotification(
          JSON.parse(tokenEntry.token),
          JSON.stringify({ title, body, data, url }),
        );
        sent++;
      } else if ((tokenEntry.type === "android" || tokenEntry.type === "ios") && fcm) {
        await fcm.send({
          token: tokenEntry.token,
          notification: { title, body },
          data: { ...data, url: url ?? "" },
        });
        sent++;
      }
    } catch (err) {
      failures.push({ token: tokenEntry.token, error: err.message });
    }
  }

  return { sent, failures };
}

// ── Campaign bulk push ────────────────────────────────────────────────────────
export async function sendCampaignPush({ fanProfileIds, title, body, url, campaignId }) {
  let totalSent = 0;
  for (const id of fanProfileIds) {
    const result = await sendPushToFan({ fanProfileId: id, title, body, url, data: { campaignId } });
    totalSent += result.sent;
  }
  return { totalSent };
}

// ── VAPID public key for frontend subscription ────────────────────────────────
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY ?? null;
}
