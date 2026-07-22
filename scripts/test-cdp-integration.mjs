/**
 * Coxa CDP Local Integration Test
 * Tests connectivity from local machine to EC2-hosted RudderStack + PostHog.
 * Run: node scripts/test-cdp-integration.mjs
 */
import https from "https";
import http from "http";
import { loadEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const dataPlane = envOr("RUDDERSTACK_DATA_PLANE_URL", "http://localhost:8080");
const posthogHost = envOr("POSTHOG_HOST", "http://localhost:8000");
const EC2_IP = (() => {
  try {
    return new URL(dataPlane).hostname;
  } catch {
    return envOr("EC2_PUBLIC_IP", "127.0.0.1");
  }
})();

const RUDDERSTACK = {
  dataPlaneUrl: dataPlane.includes("://") ? dataPlane : `http://${EC2_IP}:8080`,
  writeKey: envOr("RUDDERSTACK_BACKEND_WRITE_KEY", ""),
  webWriteKey: envOr("RUDDERSTACK_WEB_WRITE_KEY", ""),
};

const POSTHOG = {
  host: posthogHost.includes("://") ? posthogHost : `http://${EC2_IP}:8000`,
  projectKey: envOr("POSTHOG_PROJECT_API_KEY", "phc_REPLACE_ME"),
};

function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === "https:" ? https : http;
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.auth && { Authorization: "Basic " + Buffer.from(options.auth + ":").toString("base64") }),
        ...(body && { "Content-Length": Buffer.byteLength(body) }),
        ...options.headers,
      },
      timeout: 8000,
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolve({ status: 0, body: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
    if (body) req.write(body);
    req.end();
  });
}

function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.log(`  ✗ ${msg}`); }
function info(msg) { console.log(`  → ${msg}`); }

console.log("\n════════════════════════════════════════════════════");
console.log(" Coxa CDP Integration Test");
console.log(` EC2: ${EC2_IP}  (us-east-1, t3.medium)`);
console.log("════════════════════════════════════════════════════\n");

// ─── TEST 1: RudderStack Transformer Health ──────────────────────────────
console.log("TEST 1 — RudderStack Transformer health");
const txRes = await request(`http://${EC2_IP}:9090/health`);
if (txRes.status === 200 && txRes.body.includes("UP")) {
  const v = JSON.parse(txRes.body);
  pass(`Transformer UP — version ${v.version}`);
} else {
  fail(`Transformer not ready: HTTP ${txRes.status} — ${txRes.body.slice(0, 100)}`);
}

// ─── TEST 2: RudderStack Data-Plane Health ───────────────────────────────
console.log("\nTEST 2 — RudderStack data-plane health (:8080)");
const dpRes = await request(`${RUDDERSTACK.dataPlaneUrl}/health`);
if (dpRes.status === 200) {
  pass(`Data-plane UP — ${dpRes.body.slice(0, 80)}`);
} else if (dpRes.status === 0) {
  fail(`Data-plane not reachable — ${dpRes.body}`);
  info("RudderStack server container may not have started yet.");
  info("Run on EC2: docker-compose -f docker-compose.cdp.yml up -d rudderstack");
} else {
  fail(`Data-plane HTTP ${dpRes.status}: ${dpRes.body.slice(0, 100)}`);
}

// ─── TEST 3: RudderStack Send Test Event ────────────────────────────────
console.log("\nTEST 3 — RudderStack track event (backend write key)");
if (dpRes.status === 200) {
  const trackRes = await request(`${RUDDERSTACK.dataPlaneUrl}/v1/track`, {
    method: "POST",
    auth: RUDDERSTACK.writeKey,
    body: {
      userId: "test-fan-integration-001",
      event: "Backend Integration Test",
      properties: {
        source: "test-cdp-integration.mjs",
        timestamp: new Date().toISOString(),
        environment: "local-to-ec2-test",
      },
      context: {
        app: { name: "coxa-backend-test" },
      },
    },
  });
  if (trackRes.status === 200) {
    pass(`Track event accepted — ${trackRes.body}`);
  } else {
    fail(`Track failed HTTP ${trackRes.status}: ${trackRes.body.slice(0, 150)}`);
  }
} else {
  info("Skipped — data-plane not running");
}

// ─── TEST 4: RudderStack Identify (fan profile) ──────────────────────────
console.log("\nTEST 4 — RudderStack identify (fan profile)");
if (dpRes.status === 200) {
  const idRes = await request(`${RUDDERSTACK.dataPlaneUrl}/v1/identify`, {
    method: "POST",
    auth: RUDDERSTACK.writeKey,
    body: {
      userId: "test-fan-integration-001",
      traits: {
        email: "testfan@coxa.local",
        name: "Test Fan",
        memberId: "MBR-TEST-001",
        loyaltyTier: "gold",
        fanScore: 850,
        tenantId: "coxa-club-001",
      },
    },
  });
  if (idRes.status === 200) {
    pass(`Identify accepted — ${idRes.body}`);
  } else {
    fail(`Identify failed HTTP ${idRes.status}: ${idRes.body.slice(0, 150)}`);
  }
} else {
  info("Skipped — data-plane not running");
}

// ─── TEST 5: PostHog Health ──────────────────────────────────────────────
console.log("\nTEST 5 — PostHog health (:8000)");
const phRes = await request(`${POSTHOG.host}/_health`);
if (phRes.status === 200) {
  pass("PostHog healthy");
} else if (phRes.status === 503) {
  fail("PostHog returning 503 — still starting up (database migrations running)");
  info("This is normal for first start. Wait 2-3 minutes and retry.");
  info(`Then open http://${EC2_IP}:8000 to create your admin account.`);
} else if (phRes.status === 0) {
  fail(`PostHog not reachable — ${phRes.body}`);
} else {
  info(`PostHog HTTP ${phRes.status}: ${phRes.body.slice(0, 100)}`);
}

// ─── TEST 6: PostHog capture (if key is set) ─────────────────────────────
console.log("\nTEST 6 — PostHog capture event");
if (POSTHOG.projectKey.startsWith("phc_REPLACE")) {
  info("Skipped — set POSTHOG_PROJECT_API_KEY env var after completing PostHog setup");
  info(`Get it from: http://${EC2_IP}:8000 → Settings → Project API Key`);
} else if (phRes.status === 200) {
  const capRes = await request(`${POSTHOG.host}/capture/`, {
    method: "POST",
    body: {
      api_key: POSTHOG.projectKey,
      distinct_id: "test-fan-integration-001",
      event: "Backend Integration Test",
      properties: {
        source: "test-cdp-integration.mjs",
        timestamp: new Date().toISOString(),
      },
    },
  });
  if (capRes.status === 200 || capRes.status === 204) {
    pass(`PostHog event captured — HTTP ${capRes.status}`);
  } else {
    fail(`PostHog capture failed HTTP ${capRes.status}: ${capRes.body.slice(0, 150)}`);
  }
} else {
  info("Skipped — PostHog not ready");
}

// ─── Summary ─────────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════════════════");
console.log(" Summary");
console.log("════════════════════════════════════════════════════");
console.log(`  RudderStack Transformer: ${dpRes.status === 200 || txRes.status === 200 ? "✓ Running" : "✗ Not running"}`);
console.log(`  RudderStack Data-Plane:  ${dpRes.status === 200 ? "✓ Running" : "✗ Not running"}`);
console.log(`  PostHog:                 ${phRes.status === 200 ? "✓ Running" : phRes.status === 503 ? "⏳ Starting up" : "✗ Not running"}`);
console.log(`\n  EC2 IP: ${EC2_IP}`);
console.log(`  RudderStack endpoint: http://${EC2_IP}:8080`);
console.log(`  PostHog UI:           http://${EC2_IP}:8000`);

if (dpRes.status !== 200) {
  console.log("\n  ACTION REQUIRED:");
  console.log("  SSH to EC2 and start RudderStack:");
  console.log(`  ssh -i Coxa_Services.pem ubuntu@${EC2_IP}`);
  console.log("  cd /path/to/coxa");
  console.log("  bash scripts/cdp-startup.sh");
}
console.log("");


