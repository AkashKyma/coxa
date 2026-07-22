/**
 * Set PostHog API key in all .env files
 * Usage: node scripts/set-posthog-key.mjs phc_YOUR_KEY_HERE
 *
 * PostHog URL is read from .env (IP changes on restart)
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import http from "http";
import { loadEnv, envOr, ROOT } from "./lib/load-env.mjs";

loadEnv();

const COXA_DIR = ROOT;
const posthogHost = envOr("POSTHOG_HOST", "http://localhost:8000");
const EC2_IP = (() => {
  try {
    return new URL(posthogHost).hostname;
  } catch {
    return envOr("EC2_PUBLIC_IP", "127.0.0.1");
  }
})();
const key = process.argv[2];

if (!key) {
  console.log("Usage: node scripts/set-posthog-key.mjs phc_YOUR_KEY_HERE");
  console.log("");
  console.log("Steps to get your PostHog key:");
  console.log(`  1. Get current IP: node scripts/get-current-ip.mjs`);
  console.log(`  2. Open PostHog:   http://<IP>:8000`);
  console.log("  3. Login:          admin@coxa.live / CoxaLive2024");
  console.log("  4. Go to:          Settings → Project → copy API Key (phc_...)");
  console.log("  5. Run:            node scripts/set-posthog-key.mjs phc_YOUR_KEY_HERE");
  process.exit(0);
}

if (!key.startsWith("phc_")) {
  console.log(`Error: PostHog API keys start with "phc_". Got: ${key}`);
  process.exit(1);
}

console.log(`\nSetting PostHog key: ${key}\n`);

function updateEnv(f, k, v) {
  let c = ""; try { c = readFileSync(f, "utf8"); } catch { c = ""; }
  const re = new RegExp(`^${k}=.*$`, "m");
  c = re.test(c) ? c.replace(re, `${k}=${v}`) : c + `\n${k}=${v}`;
  writeFileSync(f, c, "utf8");
  console.log(`  ✓ ${f.split(/[/\\]/).slice(-3).join("/")}`);
}

// Backend
updateEnv(join(COXA_DIR, ".env"), "POSTHOG_PROJECT_API_KEY", key);

// All frontends (fanbox-dashboard intentionally excluded — no client-side tracking)
for (const app of ["fan-auth", "fan-dashboard", "fan-landing", "club-dashboard"]) {
  updateEnv(join(COXA_DIR, "apps", app, ".env"), "VITE_POSTHOG_KEY", key);
}

// Verify by sending a capture event
console.log("\nVerifying key with PostHog capture event...");
const r = await new Promise((resolve) => {
  const body = JSON.stringify({ api_key: key, distinct_id: "setup-verify", event: "Phase 1 Configured" });
  const req = http.request({
    hostname: EC2_IP, port: 8000, path: "/capture/", method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    timeout: 8000,
  }, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ status: res.statusCode, body: d })); });
  req.on("error", () => resolve({ status: 0, body: "network error" }));
  req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "timeout" }); });
  req.write(body); req.end();
});

if (r.status === 200 || r.status === 204) {
  console.log("  ✓ PostHog capture verified!");
} else {
  console.log(`  ⚠ Capture: HTTP ${r.status} — ${r.body.slice(0, 100)}`);
  console.log("  (Key saved anyway — capture may work after PostHog fully initializes)");
}

console.log("\n✓ All .env files updated.");
console.log("  Restart backend + frontend apps to apply the new key.");
