/**
 * PostHog Node.js client singleton.
 *
 * Used for server-side event capture, feature flag evaluation, and
 * experiment tracking. In production, hits self-hosted PostHog instance.
 */
import { PostHog } from "posthog-node";

let client = null;

export function getPostHogClient() {
  if (client) return client;

  const apiKey = process.env.POSTHOG_PROJECT_API_KEY;
  const host = process.env.POSTHOG_HOST;

  if (!apiKey || !host) return null;

  client = new PostHog(apiKey, {
    host,
    flushAt: 20,
    flushInterval: 10_000,
  });

  return client;
}

/**
 * Probe the PostHog /capture endpoint with a lightweight ping event.
 * Logs success/failure and returns a status object for the startup summary.
 */
export async function probePostHogConnection() {
  const tag = "[posthog]";
  const apiKey = process.env.POSTHOG_PROJECT_API_KEY;
  const host = process.env.POSTHOG_HOST;

  if (!apiKey || !host) {
    console.warn(`${tag} disabled — POSTHOG_PROJECT_API_KEY or POSTHOG_HOST not set`);
    return { ok: false, reason: "env not configured" };
  }

  try {
    const url = new URL("/capture/", host);
    const body = JSON.stringify({
      api_key: apiKey,
      distinct_id: "coxa-backend-probe",
      event: "$$backend_probe",
      properties: { $$process_person_profile: false },
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      console.log(
        `${tag} ✓ connected  host=${host}  key=${apiKey.slice(0, 12)}…`
      );
      return { ok: true };
    }

    console.warn(`${tag} ✗ capture returned HTTP ${res.status}`);
    return { ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    const reason = err.name === "AbortError" ? "timeout (5 s)" : err.message;
    console.warn(`${tag} ✗ unreachable — ${reason}`);
    return { ok: false, reason };
  }
}

export function isPostHogEnabled() {
  return Boolean(process.env.POSTHOG_PROJECT_API_KEY && process.env.POSTHOG_HOST);
}

export async function shutdownPostHog() {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
