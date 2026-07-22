/**
 * Cube REST API client — thin wrapper around the Cube /v1/load endpoint.
 *
 * Sends Cube query objects and returns result sets.
 * Falls back gracefully when Cube is unavailable (returns null).
 *
 * Phase 2 usage:
 *   import { cubeQuery, isCubeEnabled } from "./cubeClient.js";
 *
 *   const result = await cubeQuery({
 *     measures: ["Sales.totalRevenueCents"],
 *     dimensions: ["Sales.channel"],
 *     timeDimensions: [{ dimension: "Sales.saleDate", dateRange: ["2026-01-01", "2026-12-31"] }],
 *   }, tenantId);
 */

const CUBE_API_URL = process.env.CUBE_API_URL || "http://localhost:4000/cubejs-api/v1";
const CUBE_API_SECRET = process.env.CUBE_API_SECRET;

/**
 * Generate a Cube JWT token scoped to a tenant.
 * In production use a proper JWT library; for dev, Cube accepts the raw secret.
 */
function getCubeToken(tenantId) {
  if (!CUBE_API_SECRET) return null;
  // Cube accepts the API secret directly as a bearer token in dev mode.
  // For production: sign a JWT with { tenantId } payload using CUBE_API_SECRET.
  return CUBE_API_SECRET;
}

export function isCubeEnabled() {
  return Boolean(process.env.CUBE_API_URL || process.env.CUBE_API_SECRET);
}

/**
 * Execute a Cube query.
 *
 * @param {Object} query - Cube query object
 * @param {string} tenantId - Tenant for token scoping
 * @param {Object} [opts]
 * @param {number} [opts.timeoutMs=10000] - Timeout in ms
 * @returns {Promise<Array|null>} - Array of row objects, or null on error
 */
export async function cubeQuery(query, tenantId, { timeoutMs = 10_000 } = {}) {
  if (!isCubeEnabled()) return null;

  const token = getCubeToken(tenantId);
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${CUBE_API_URL}/load`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Cube] HTTP ${response.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const json = await response.json();
    return json.data ?? null;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[Cube] Query timed out");
    } else {
      console.error("[Cube] Query failed (non-fatal):", err.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convenience: query a single measure with optional date range.
 *
 * @param {string} measure - e.g. "Sales.totalRevenueCents"
 * @param {string} tenantId
 * @param {Object} [dateRange] - { from: "2026-01-01", to: "2026-12-31" }
 * @param {string} [timeDimension] - e.g. "Sales.saleDate"
 * @returns {Promise<number|null>}
 */
export async function cubeScalar(measure, tenantId, dateRange, timeDimension) {
  const query = { measures: [measure] };

  if (dateRange && timeDimension) {
    query.timeDimensions = [
      {
        dimension: timeDimension,
        dateRange: [dateRange.from, dateRange.to],
      },
    ];
  }

  const rows = await cubeQuery(query, tenantId);
  if (!rows || rows.length === 0) return null;

  const [cube, field] = measure.split(".");
  return rows[0][`${cube}.${field}`] ?? rows[0][measure] ?? null;
}

/**
 * Convenience: query a breakdown (measure × dimension).
 *
 * @param {string} measure
 * @param {string} dimension
 * @param {string} tenantId
 * @param {Object} [dateRange]
 * @param {string} [timeDimension]
 * @returns {Promise<Array|null>}
 */
export async function cubeBreakdown(measure, dimension, tenantId, dateRange, timeDimension) {
  const query = {
    measures: [measure],
    dimensions: [dimension],
  };

  if (dateRange && timeDimension) {
    query.timeDimensions = [
      {
        dimension: timeDimension,
        dateRange: [dateRange.from, dateRange.to],
      },
    ];
  }

  return cubeQuery(query, tenantId);
}

/**
 * Convenience: time-series query for a measure with granularity.
 *
 * @param {string} measure
 * @param {string} timeDimension
 * @param {'day'|'week'|'month'|'quarter'|'year'} granularity
 * @param {string} tenantId
 * @param {Object} dateRange
 * @returns {Promise<Array|null>}
 */
export async function cubeTimeSeries(measure, timeDimension, granularity, tenantId, dateRange) {
  const query = {
    measures: [measure],
    timeDimensions: [
      {
        dimension: timeDimension,
        granularity,
        dateRange: [dateRange.from, dateRange.to],
      },
    ],
  };

  return cubeQuery(query, tenantId);
}
