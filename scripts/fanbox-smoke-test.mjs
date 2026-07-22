/**
 * FanBox API smoke test — run against local backend (:5000).
 * Usage: node scripts/fanbox-smoke-test.mjs
 */
const BASE = process.env.API_URL ?? "http://localhost:5000";
const CLUB_ID = process.env.CLUB_ID ?? "coritiba";
const EMAIL = process.env.FANBOX_EMAIL ?? "admin@coxa.local";
const PASSWORD = process.env.FANBOX_PASSWORD ?? "CoxaDemo123!";

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function json(path, opts = {}, auth = false) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.clubId) headers["X-Club-Id"] = auth.clubId;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  console.log(`FanBox smoke test → ${BASE}\n`);

  // Health
  try {
    const { res } = await json("/api/health");
    if (res.ok) pass("GET /api/health");
    else fail("GET /api/health", `HTTP ${res.status}`);
  } catch (e) {
    fail("GET /api/health", e.message);
    console.error("\nBackend not reachable. Start with: npm run dev --workspace=coxa-backend");
    process.exit(1);
  }

  // Login
  let token;
  let clubId;
  try {
    const { res, body } = await json("/api/v1/fanbox/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    token = body.data?.token ?? body.token;
    clubId = body.data?.club?._id ?? body.data?.club?.id;
    if (res.ok && token && clubId) pass("POST /fanbox/auth/login", `club=${clubId}`);
    else fail("POST /fanbox/auth/login", body.message ?? `HTTP ${res.status}`);
  } catch (e) {
    fail("POST /fanbox/auth/login", e.message);
  }

  if (!token || !clubId) {
    printSummary();
    process.exit(1);
  }

  const auth = { token, clubId };

  // Status with valid club header
  try {
    const { res, body } = await json(`/api/v1/fanbox/status`, {}, { clubId });
    if (res.ok && body.module === "fanbox") pass("GET /fanbox/status", `enabled=${body.enabled}`);
    else fail("GET /fanbox/status", body.message ?? `HTTP ${res.status}`);
  } catch (e) {
    fail("GET /fanbox/status", e.message);
  }

  const endpoints = [
    ["GET /fanbox/auth/me", "/api/v1/fanbox/auth/me"],
    ["GET /fanbox/analytics/fan-counters", "/api/v1/fanbox/analytics/fan-counters"],
    ["GET /fanbox/analytics/fan-growth", "/api/v1/fanbox/analytics/fan-growth?days=30"],
    ["GET /fanbox/analytics/engagement-reports", "/api/v1/fanbox/analytics/engagement-reports"],
    ["GET /fanbox/analytics/spend-reports", "/api/v1/fanbox/analytics/spend-reports"],
    ["GET /fanbox/analytics/fan-demographics", "/api/v1/fanbox/analytics/fan-demographics"],
    ["GET /fanbox/analytics/business/membership", "/api/v1/fanbox/analytics/business/membership"],
    ["GET /fanbox/intelligence/filters", "/api/v1/fanbox/intelligence/filters"],
    ["GET /fanbox/campaigns", "/api/v1/fanbox/campaigns"],
    ["GET /fanbox/campaigns/templates", "/api/v1/fanbox/campaigns/templates"],
    ["GET /fanbox/projects", "/api/v1/fanbox/projects"],
    ["GET /fanbox/staff", "/api/v1/fanbox/staff"],
  ];

  for (const [label, path] of endpoints) {
    try {
      const { res, body } = await json(path, {}, auth);
      if (res.ok) pass(label);
      else fail(label, body.message ?? body.code ?? `HTTP ${res.status}`);
    } catch (e) {
      fail(label, e.message);
    }
  }

  // Create + delete saved filter
  const filterName = `Smoke test filter ${Date.now()}`;
  try {
    const { res, body } = await json(
      "/api/v1/fanbox/intelligence/filters",
      {
        method: "POST",
        body: JSON.stringify({
          name: filterName,
          rules: [{ field: "email", operator: "exists" }],
        }),
      },
      auth
    );
    const id = body.data?._id ?? body.data?.id;
    if (res.ok && id) {
      pass("POST /fanbox/intelligence/filters");
      const del = await json(`/api/v1/fanbox/intelligence/filters/${id}`, { method: "DELETE" }, auth);
      if (del.res.ok) pass("DELETE /fanbox/intelligence/filters/:id");
      else fail("DELETE /fanbox/intelligence/filters/:id", `HTTP ${del.res.status}`);
    } else {
      fail("POST /fanbox/intelligence/filters", body.message ?? `HTTP ${res.status}`);
    }
  } catch (e) {
    fail("POST /fanbox/intelligence/filters", e.message);
  }

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n--- ${ok}/${total} passed ---`);
}

main();
