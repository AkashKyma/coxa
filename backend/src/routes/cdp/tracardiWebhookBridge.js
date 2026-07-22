/**
 * Tracardi Webhook Bridge — Phase 3
 *
 * RudderStack delivers processed events to this endpoint via the
 * "Webhook" destination in workspaceConfig.json.
 *
 * This bridge:
 *  1. Validates the RudderStack webhook secret
 *  2. Translates each RudderStack event to Tracardi's event format
 *  3. Forwards to the Tracardi /track API in a fire-and-forget manner
 *  4. Always returns 200 to RudderStack so no events are lost
 *
 * Route: POST /api/v1/cdp/tracardi-bridge
 *
 * Expected RudderStack event shapes:
 *   { type: "track",    userId, anonymousId, event, properties, context }
 *   { type: "identify", userId, anonymousId, traits, context }
 *   { type: "page",     userId, anonymousId, name, properties, context }
 */

import { Router } from "express";

const router = Router();

const TRACARDI_HOST = process.env.TRACARDI_HOST ?? "https://tracardi-api.service.coxa.live";
const TRACARDI_SOURCE_ID = process.env.TRACARDI_SOURCE_ID ?? "coxa-rudderstack-bridge";
const TRACARDI_USERNAME = process.env.TRACARDI_USERNAME ?? "admin@coxa.live";
const TRACARDI_PASSWORD = process.env.TRACARDI_PASSWORD ?? "admin";
const WEBHOOK_SECRET = process.env.RUDDERSTACK_WEBHOOK_SECRET ?? "";

// ── Tracardi auth token cache ─────────────────────────────────────────────────
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  try {
    const res = await fetch(`${TRACARDI_HOST}/user/token?keep_signed_in=false`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: TRACARDI_USERNAME, password: TRACARDI_PASSWORD }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    _token = json.access_token;
    _tokenExpiry = Date.now() + 12 * 60 * 1000;
    return _token;
  } catch {
    return null;
  }
}

// ── Translate one RudderStack event → Tracardi event object ──────────────────

function toTracardiEvent(rsEvent) {
  const { type, userId, anonymousId, event, traits, properties, context } = rsEvent;

  const profileId = userId || anonymousId || "anonymous";
  const sessionId = context?.sessionId ?? context?.app?.version ?? anonymousId ?? "no-session";

  let eventType;
  if (type === "identify") eventType = "profile-update";
  else if (type === "page") eventType = "page-visit";
  else eventType = (event ?? "custom-event").replace(/[._]/g, "-");

  return {
    source: { id: TRACARDI_SOURCE_ID },
    session: { id: sessionId },
    profile: { id: profileId },
    context: {
      page: {
        url: properties?.url ?? context?.page?.url ?? "",
        path: properties?.path ?? context?.page?.path ?? "",
        referrer: properties?.referrer ?? context?.page?.referrer ?? "",
        title: properties?.title ?? context?.page?.title ?? "",
      },
    },
    properties: type === "identify" ? (traits ?? {}) : (properties ?? {}),
    event: eventType,
    time: rsEvent.originalTimestamp ?? rsEvent.receivedAt ?? new Date().toISOString(),
  };
}

// ── Send to Tracardi (best-effort) ────────────────────────────────────────────

async function forwardToTracardi(trEvent) {
  try {
    const token = await getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${TRACARDI_HOST}/track`, {
      method: "POST",
      headers,
      body: JSON.stringify(trEvent),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.warn(`[tracardi-bridge] Tracardi responded ${res.status}`);
    }
  } catch (err) {
    console.warn(`[tracardi-bridge] Forward failed: ${err.message}`);
  }
}

// ── Ensure Tracardi source exists (called once on server start) ───────────────
export async function ensureTracardiSource() {
  try {
    const token = await getToken();
    if (!token) {
      console.warn("[tracardi-bridge] Cannot auth with Tracardi — source setup skipped");
      return;
    }

    // Check if source already exists
    const check = await fetch(`${TRACARDI_HOST}/source/${TRACARDI_SOURCE_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (check.status === 200) {
      console.log(`[tracardi-bridge] ✓ Source "${TRACARDI_SOURCE_ID}" already exists`);
      return;
    }

    // Create the source
    const create = await fetch(`${TRACARDI_HOST}/source`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: TRACARDI_SOURCE_ID,
        name: "Coxa RudderStack Bridge",
        type: "rest",
        description: "Events forwarded from RudderStack via the Coxa backend webhook bridge",
        enabled: true,
        tags: ["coxa", "rudderstack"],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (create.ok) {
      console.log(`[tracardi-bridge] ✓ Created Tracardi source "${TRACARDI_SOURCE_ID}"`);
    } else {
      const body = await create.text();
      console.warn(`[tracardi-bridge] Source creation returned ${create.status}: ${body.slice(0, 120)}`);
    }
  } catch (err) {
    console.warn(`[tracardi-bridge] ensureTracardiSource failed: ${err.message}`);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  if (WEBHOOK_SECRET) {
    const provided = req.headers["x-rudderstack-secret"] ?? req.headers["x-webhook-secret"];
    if (provided !== WEBHOOK_SECRET) {
      return res.status(401).json({ code: "UNAUTHORIZED" });
    }
  }

  const batch = Array.isArray(req.body) ? req.body : req.body.batch ?? [req.body];
  let forwarded = 0;

  for (const rsEvent of batch) {
    if (!rsEvent?.type) continue;
    const trEvent = toTracardiEvent(rsEvent);
    forwardToTracardi(trEvent); // fire and forget
    forwarded++;
  }

  res.status(200).json({ received: batch.length, forwarded });
});

export default router;
