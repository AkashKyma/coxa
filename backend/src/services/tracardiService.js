/**
 * Tracardi Service — Phase 3
 *
 * Proxies requests to the self-hosted Tracardi API on EC2.
 * Tracardi is the visual segment + workflow builder deployed as part of
 * the CDP stack (docker-compose.cdp.yml).
 *
 * All calls are best-effort: if Tracardi is unreachable (e.g. EC2 down)
 * we return empty data so the dashboards degrade gracefully.
 */

const TRACARDI_HOST = process.env.TRACARDI_HOST ?? "https://tracardi-api.service.coxa.live";
const TRACARDI_USERNAME = process.env.TRACARDI_USERNAME ?? "admin@coxa.live";
const TRACARDI_PASSWORD = process.env.TRACARDI_PASSWORD ?? "admin";

let _cachedToken = null;
let _tokenExpiry = 0;

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getAuthToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const res = await fetch(`${TRACARDI_HOST}/user/token?keep_signed_in=false`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: TRACARDI_USERNAME, password: TRACARDI_PASSWORD }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`Tracardi auth failed: HTTP ${res.status}`);
  const json = await res.json();
  _cachedToken = json.access_token;
  // Tracardi tokens are valid for 15 min; cache for 12 to be safe
  _tokenExpiry = Date.now() + 12 * 60 * 1000;
  return _cachedToken;
}

async function tracardiGet(path) {
  const token = await getAuthToken();
  const res = await fetch(`${TRACARDI_HOST}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Tracardi GET ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Segments ─────────────────────────────────────────────────────────────────

/**
 * List all segments defined in Tracardi.
 * Returns an array of normalised segment objects:
 *   { id, name, description, eventType, condition, enabled, updatedAt }
 */
export async function listTracardiSegments() {
  try {
    // Tracardi paginates — fetch up to 200 segments in one shot
    const data = await tracardiGet("/segments?start=0&limit=200");
    const raw = data?.result ?? data?.data ?? [];
    return raw.map((s) => ({
      id: s.id ?? s._id,
      name: s.name ?? s.id,
      description: s.description ?? "",
      eventType: s.eventType ?? s.event_type ?? null,
      condition: s.condition ?? s.segmentation ?? null,
      enabled: s.enabled !== false,
      updatedAt: s.timestamp?.update ?? s.updateAt ?? null,
      source: "tracardi",
    }));
  } catch (err) {
    console.warn(`[tracardiService] listSegments failed: ${err.message}`);
    return [];
  }
}

/**
 * Get a single Tracardi segment by ID.
 */
export async function getTracardiSegment(segmentId) {
  try {
    const data = await tracardiGet(`/segment/${segmentId}`);
    const s = data?.result ?? data;
    return {
      id: s.id ?? s._id,
      name: s.name ?? s.id,
      description: s.description ?? "",
      eventType: s.eventType ?? s.event_type ?? null,
      condition: s.condition ?? s.segmentation ?? null,
      enabled: s.enabled !== false,
      updatedAt: s.timestamp?.update ?? null,
      source: "tracardi",
    };
  } catch (err) {
    console.warn(`[tracardiService] getSegment(${segmentId}) failed: ${err.message}`);
    return null;
  }
}

/**
 * List all profiles matching a Tracardi segment.
 * Returns an array of simplified profile objects.
 */
export async function getTracardiSegmentProfiles(segmentId, { limit = 100 } = {}) {
  try {
    const data = await tracardiGet(
      `/profiles/by_segment?segment=${encodeURIComponent(segmentId)}&start=0&limit=${limit}`
    );
    const raw = data?.result ?? data?.data ?? [];
    return raw.map((p) => ({
      id: p.id ?? p._id,
      email: p.data?.pii?.email ?? p.data?.contact?.email ?? null,
      name: [p.data?.pii?.firstName, p.data?.pii?.lastName].filter(Boolean).join(" ") || null,
      segments: p.segments ?? [],
      lastSeen: p.last_geo_location?.timestamp ?? p.metadata?.time?.update ?? null,
    }));
  } catch (err) {
    console.warn(`[tracardiService] getSegmentProfiles(${segmentId}) failed: ${err.message}`);
    return [];
  }
}

/**
/**
 * Health-check — returns true if Tracardi is reachable (HTTP response of any kind).
 * Auth failure still counts as "online" — it means the service is up but
 * credentials may need updating. A network/timeout error means "offline".
 */
export async function pingTracardi() {
  try {
    // Hit the root or a lightweight endpoint — any HTTP response means the service is up
    const res = await fetch(`${TRACARDI_HOST}/`, {
      signal: AbortSignal.timeout(5000),
    });
    // Any HTTP response (including 401/403/404) means Tracardi is running
    return res.status < 500 || res.status === 503 ? true : res.status < 600;
  } catch {
    // Network error, timeout, ECONNREFUSED → genuinely offline
    return false;
  }
}
