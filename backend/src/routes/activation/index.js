/**
 * Activation Route — Phase 4
 *
 * Proxies Multiwoven sync status so the fanbox-dashboard can show
 * per-segment activation badges without direct browser access to Multiwoven.
 *
 * Multiwoven is self-hosted at MULTIWOVEN_HOST (default :3050 on EC2).
 *
 * GET /api/v1/activation/sync-status
 *   → { syncs: [{ segmentId, segmentName, status, lastSyncAt, destinationCount }] }
 */

import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

const MULTIWOVEN_HOST = process.env.MULTIWOVEN_HOST ?? "https://multiwoven.service.coxa.live";
const MULTIWOVEN_API_KEY = process.env.MULTIWOVEN_API_KEY ?? "";

// ── Multiwoven API helper ─────────────────────────────────────────────────────
async function multiwovenGet(path) {
  const headers = { "Content-Type": "application/json" };
  if (MULTIWOVEN_API_KEY) headers["Authorization"] = `Bearer ${MULTIWOVEN_API_KEY}`;

  const res = await fetch(`${MULTIWOVEN_HOST}${path}`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Multiwoven API ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Normalise Multiwoven sync_run records to our shape ────────────────────────
function normaliseSync(raw) {
  // Multiwoven model names often map 1:1 to segment names
  const modelName = raw.model?.name ?? raw.sync?.model?.name ?? null;
  return {
    segmentId: modelName ?? raw.id ?? raw.sync_id,
    segmentName: modelName,
    status: mapStatus(raw.status),
    lastSyncAt: raw.finished_at ?? raw.started_at ?? raw.created_at ?? null,
    destinationCount: raw.sync?.connector?.name ? 1 : 0,
    connectorName: raw.sync?.connector?.name ?? null,
  };
}

function mapStatus(s) {
  if (!s) return "pending";
  const lower = String(s).toLowerCase();
  if (lower === "success" || lower === "completed") return "success";
  if (lower === "failed" || lower === "error") return "failed";
  return "pending";
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get("/sync-status", requireAuth, async (req, res) => {
  try {
    // Multiwoven: GET /api/v1/sync_runs?page=1&per_page=50
    const data = await multiwovenGet("/api/v1/sync_runs?page=1&per_page=50");
    const runs = data?.data ?? data?.sync_runs ?? data ?? [];

    // Deduplicate — keep the most recent run per sync
    const bySync = new Map();
    for (const run of Array.isArray(runs) ? runs : []) {
      const norm = normaliseSync(run);
      const key = norm.segmentName ?? norm.segmentId ?? "unknown";
      const existing = bySync.get(key);
      if (!existing || (norm.lastSyncAt && norm.lastSyncAt > existing.lastSyncAt)) {
        bySync.set(key, norm);
      }
    }

    res.json({ syncs: Array.from(bySync.values()), source: "multiwoven" });
  } catch (err) {
    // Graceful degradation — Multiwoven may not be configured
    console.warn(`[activation] sync-status failed: ${err.message}`);
    res.json({ syncs: [], source: "multiwoven", error: err.message });
  }
});

export default router;
