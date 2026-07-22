/**
 * RudderStack SDK singleton — Central event streaming client for Coxa CDP.
 *
 * All backend services emit events through this module. Events flow:
 *   Service → RudderStack → Destinations (MongoDB via webhook, PostHog, ClickHouse later)
 *
 * In development, if RUDDERSTACK_DATA_PLANE_URL is not set, events fall through
 * to the legacy local eventBus so the app keeps working without Docker infra.
 */
import Analytics from "@rudderstack/rudder-sdk-node";

let client = null;
let initialized = false;

const config = {
  writeKey: process.env.RUDDERSTACK_BACKEND_WRITE_KEY,
  dataPlaneUrl: process.env.RUDDERSTACK_DATA_PLANE_URL,
  flushAt: 20,
  flushInterval: 10_000, // 10s max buffering
  logLevel: process.env.NODE_ENV === "production" ? "error" : "info",
};

export function getRudderClient() {
  if (client) return client;

  if (!config.writeKey || !config.dataPlaneUrl) {
    return null; // graceful fallback — caller uses legacy path
  }

  client = new Analytics(config.writeKey, {
    dataPlaneUrl: config.dataPlaneUrl,
    flushAt: config.flushAt,
    flushInterval: config.flushInterval,
    logLevel: config.logLevel,
  });

  initialized = true;
  return client;
}

/**
 * Probe the RudderStack data-plane /health endpoint.
 * Logs success/failure and returns a status object for the startup summary.
 */
export async function probeRudderConnection() {
  const tag = "[rudderstack]";

  if (!config.writeKey || !config.dataPlaneUrl) {
    console.warn(`${tag} disabled — RUDDERSTACK_DATA_PLANE_URL or RUDDERSTACK_BACKEND_WRITE_KEY not set`);
    return { ok: false, reason: "env not configured" };
  }

  try {
    const url = new URL("/health", config.dataPlaneUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const accepting = body?.acceptingEvents === "TRUE" || body?.acceptingEvents === true;
      console.log(
        `${tag} ✓ connected  url=${config.dataPlaneUrl}  writeKey=${config.writeKey.slice(0, 12)}…  acceptingEvents=${accepting}`
      );
      return { ok: true, acceptingEvents: accepting };
    }

    console.warn(`${tag} ✗ health check returned HTTP ${res.status}`);
    return { ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    const reason = err.name === "AbortError" ? "timeout (5 s)" : err.message;
    console.warn(`${tag} ✗ unreachable — ${reason}`);
    return { ok: false, reason };
  }
}

export function isRudderEnabled() {
  return Boolean(config.writeKey && config.dataPlaneUrl);
}

export function flushRudder() {
  if (client) return client.flush();
  return Promise.resolve();
}

export function shutdownRudder() {
  if (client) {
    client.flush();
    client = null;
    initialized = false;
  }
}
