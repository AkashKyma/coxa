/**
 * Shared ioredis client.
 *
 * One Redis connection per worker process — every consumer (auth cache,
 * BullMQ producer, rate limiter, pub/sub) should import this module instead
 * of new-ing up its own client. Avoids connection-storm against ElastiCache
 * when the API is fanned across N cluster workers × M EB instances.
 *
 * Behavior:
 *   - REDIS_URL unset      → returns null and every helper is a no-op.
 *                            Lets local dev run without standing up Redis.
 *   - rediss://...         → TLS handshake (required by AWS ElastiCache
 *                            serverless and Encryption-In-Transit clusters).
 *   - redis://...          → plaintext.
 *
 * BullMQ note: BullMQ requires `maxRetriesPerRequest: null` and
 * `enableReadyCheck: false` on the *Worker/QueueScheduler* client. For
 * BullMQ, instantiate a dedicated client via `createBullMqRedis()` below.
 */

import Redis from "ioredis";

let client = null;

export function getRedis() {
  if (client) return client;

  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  client = new Redis(url, {
    // ioredis picks TLS up automatically from rediss:// — explicit options
    // only needed if you must override (CA bundle, SNI, etc.).
    lazyConnect: false,
    // Don't queue commands forever if Redis is down; surface to caller fast.
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    // Reconnect with backoff: 50ms, 100ms, 200ms... cap 2s.
    retryStrategy: (times) => Math.min(times * 50, 2_000),
    // Helpful for SSE / long-lived sessions on ElastiCache serverless
    keepAlive: 30_000,
    connectionName: `coxa-api-${process.pid}`,
  });

  client.on("connect", () => console.log(`[redis] connected pid=${process.pid}`));
  client.on("error", (err) => console.warn("[redis] error:", err.message));
  client.on("end", () => console.warn("[redis] connection closed"));

  return client;
}

/**
 * BullMQ requires its own connection settings. Always returns a NEW client
 * (BullMQ holds the connection for blocking commands and shouldn't share).
 */
export function createBullMqRedis() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 30_000,
  });
}

export async function disconnectRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
  client = null;
}
