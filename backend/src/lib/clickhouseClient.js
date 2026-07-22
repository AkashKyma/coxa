/**
 * ClickHouse Client — shared singleton for all backend services.
 *
 * Usage:
 *   import { getClickhouseClient, isClickhouseEnabled } from "../lib/clickhouseClient.js";
 *
 *   if (isClickhouseEnabled()) {
 *     const ch = getClickhouseClient();
 *     const result = await ch.query({ query: "SELECT 1", format: "JSONEachRow" });
 *   }
 *
 * Required env vars:
 *   CLICKHOUSE_HOST      (default: localhost)
 *   CLICKHOUSE_HTTP_PORT (default: 8123)
 *   CLICKHOUSE_USER      (default: coxa)
 *   CLICKHOUSE_PASSWORD  (default: coxa_dev_password)
 *   CLICKHOUSE_DATABASE  (default: coxa)
 */

import { createClient } from "@clickhouse/client";

let _client = null;

function buildConfig() {
  return {
    url: `http://${process.env.CLICKHOUSE_HOST ?? "localhost"}:${process.env.CLICKHOUSE_HTTP_PORT ?? "8123"}`,
    username: process.env.CLICKHOUSE_USER ?? "coxa",
    password: process.env.CLICKHOUSE_PASSWORD ?? "coxa_dev_password",
    database: process.env.CLICKHOUSE_DATABASE ?? "coxa",
    clickhouse_settings: {
      async_insert: 0,
      wait_for_async_insert: 1,
    },
    compression: { response: false, request: false },
    request_timeout: 30_000,
  };
}

/**
 * Returns true when ClickHouse env vars are configured.
 * Services use this to skip ClickHouse paths and fall back to MongoDB.
 */
export function isClickhouseEnabled() {
  return !!(process.env.CLICKHOUSE_HOST && process.env.CLICKHOUSE_USER);
}

/**
 * Returns the shared ClickHouse client instance (lazy initialisation).
 * Throws if ClickHouse env vars are not set.
 */
export function getClickhouseClient() {
  if (!isClickhouseEnabled()) {
    throw new Error(
      "[clickhouseClient] ClickHouse env vars not configured (CLICKHOUSE_HOST, CLICKHOUSE_USER)",
    );
  }

  if (!_client) {
    _client = createClient(buildConfig());
    console.log(
      `[clickhouse] client initialised — host=${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_HTTP_PORT ?? 8123}  db=${process.env.CLICKHOUSE_DATABASE ?? "coxa"}`,
    );
  }

  return _client;
}

/**
 * Closes the shared client (called during graceful shutdown).
 */
export async function closeClickhouseClient() {
  if (_client) {
    await _client.close().catch(() => {});
    _client = null;
  }
}
