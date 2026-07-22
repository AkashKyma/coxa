/**
 * Fixes PostHog "logged out immediately" via EC2 user data injection.
 * Stop instance → inject fix script as user data → start instance.
 * The fix script runs on boot and restarts only the posthog container.
 */
import https from "https";
import crypto from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const COXA_DIR = join(__dirname, "..");

const KEY_ID = requireEnv("AWS_ACCESS_KEY_ID");
const SECRET = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");

function sign(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest();
}
function signingKey(secret, date, region, service) {
  return sign(sign(sign(sign("AWS4" + secret, date), region), service), "aws4_request");
}

function ec2Request(action, extraParams = {}) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ Action: action, Version: "2016-11-15", ...extraParams });
    const body = params.toString();
    const host = `ec2.${REGION}.amazonaws.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = crypto.createHash("sha256").update(body).digest("hex");

    const canonHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    const canonRequest = ["POST", "/", "", canonHeaders, signedHeaders, payloadHash].join("\n");
    const credScope = `${dateStamp}/${REGION}/ec2/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256", amzDate, credScope,
      crypto.createHash("sha256").update(canonRequest).digest("hex"),
    ].join("\n");
    const sk = signingKey(SECRET, dateStamp, REGION, "ec2");
    const sig = crypto.createHmac("sha256", sk).update(stringToSign).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;

    const req = https.request(
      { hostname: host, path: "/", method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Amz-Date": amzDate, Authorization: auth, "Content-Length": Buffer.byteLength(body) } },
      (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ status: res.statusCode, body: d })); }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseXml(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

async function getInstanceState() {
  const r = await ec2Request("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  const state = parseXml(r.body, "name");
  return state;
}

async function getPublicIp() {
  const r = await ec2Request("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  const ip = parseXml(r.body, "ipAddress");
  return ip;
}

// The fix script — runs once on boot via cloud-init user data
const FIX_SCRIPT = `#!/bin/bash
# PostHog domain + session fix — runs once on boot
set -e
LOG=/var/log/posthog-domain-fix.log
exec >> "\$LOG" 2>&1
echo "[\$(date)] Starting PostHog domain fix..."

# Wait for docker to be ready
for i in \$(seq 1 30); do
  sudo -u ubuntu docker ps > /dev/null 2>&1 && break || sleep 5
done

cd /home/ubuntu/coxa

# Set domain-based SITE_URL (no longer IP-dependent)
DOMAIN="posthog.service.coxa.live"
if [ -f .env.cdp ]; then
  sed -i "s|POSTHOG_SITE_URL=.*|POSTHOG_SITE_URL=http://\${DOMAIN}:8000|g" .env.cdp
  echo "[\$(date)] Set POSTHOG_SITE_URL=http://\${DOMAIN}:8000"
  grep POSTHOG_SITE_URL .env.cdp
else
  echo "POSTHOG_SITE_URL=http://\${DOMAIN}:8000" >> .env.cdp
fi

# Force-recreate posthog container
echo "[\$(date)] Recreating posthog container with domain SITE_URL..."
sudo -u ubuntu docker compose -f docker-compose.cdp.yml up -d --no-deps --force-recreate posthog 2>&1

echo "[\$(date)] Waiting 30s for PostHog to start..."
sleep 30

STATUS=\$(curl -s --max-time 5 http://localhost:8000/_health || echo "unreachable")
echo "[\$(date)] PostHog health: \$STATUS"
echo "[\$(date)] PostHog domain fix COMPLETE"
`;

console.log("=== PostHog Session Fix via EC2 User Data ===\n");

// Step 1 — get current state
process.stdout.write("Checking instance state... ");
const state = await getInstanceState();
console.log(state);

// Step 2 — stop instance if running
if (state === "running") {
  process.stdout.write("Stopping instance... ");
  const stopR = await ec2Request("StopInstances", { "InstanceId.1": INSTANCE_ID });
  if (stopR.status !== 200) {
    console.error("Stop failed:", stopR.body.slice(0, 300));
    process.exit(1);
  }
  console.log("stop signal sent.");

  // Wait until stopped
  for (let i = 0; i < 30; i++) {
    await sleep(8000);
    const s = await getInstanceState();
    process.stdout.write(`\r  Waiting for stopped... ${s}          `);
    if (s === "stopped") { console.log("\n  Instance stopped."); break; }
  }
}

// Step 3 — inject user data
process.stdout.write("Injecting fix script as user data... ");
const encoded = Buffer.from(FIX_SCRIPT).toString("base64");
const modR = await ec2Request("ModifyInstanceAttribute", {
  "InstanceId": INSTANCE_ID,
  "UserData.Value": encoded,
});
if (modR.status !== 200) {
  console.error("ModifyInstanceAttribute failed:", modR.body.slice(0, 400));
  process.exit(1);
}
console.log("done.");

// Step 4 — start instance
process.stdout.write("Starting instance... ");
const startR = await ec2Request("StartInstances", { "InstanceId.1": INSTANCE_ID });
if (startR.status !== 200) {
  console.error("Start failed:", startR.body.slice(0, 300));
  process.exit(1);
}
console.log("start signal sent.");

// Step 5 — wait for new IP
process.stdout.write("Waiting for instance to come up and get public IP...");
let newIp = null;
for (let i = 0; i < 30; i++) {
  await sleep(8000);
  const s = await getInstanceState();
  const ip = await getPublicIp();
  process.stdout.write(`\r  State: ${s}  IP: ${ip ?? "pending"}          `);
  if (s === "running" && ip) { newIp = ip; console.log(`\n  Instance running. New IP: ${newIp}`); break; }
}

if (!newIp) {
  console.log("\nCould not determine new IP. Check AWS console.");
  process.exit(1);
}

// Step 6 — update all .env files with new IP
console.log(`\nUpdating all .env files with new IP: ${newIp}...`);
const files = [
  join(COXA_DIR, ".env"),
  join(COXA_DIR, "apps/fan-auth/.env"),
  join(COXA_DIR, "apps/fan-dashboard/.env"),
  join(COXA_DIR, "apps/fan-landing/.env"),
  join(COXA_DIR, "apps/club-dashboard/.env"),
  join(COXA_DIR, "backend/.env.elb.example"),
  join(COXA_DIR, "infrastructure/.env.cdp.example"),
];

for (const f of files) {
  try {
    let content = readFileSync(f, "utf8");
    const updated = content.replace(/(\d{1,3}\.){3}\d{1,3}(?=:\d{4})/g, newIp);
    if (updated !== content) { writeFileSync(f, updated); console.log(`  ✓ ${f.replace(COXA_DIR, "")}`); }
  } catch { /* file may not exist */ }
}

// Step 7 — wait for PostHog to be healthy
console.log(`\nWaiting for PostHog to be healthy at http://${newIp}:8000 ...`);
for (let i = 0; i < 20; i++) {
  await sleep(10000);
  try {
    const { default: http } = await import("http");
    const ok = await new Promise(res => {
      const r = http.get(`http://${newIp}:8000/_health`, { timeout: 5000 }, resp => res(resp.statusCode === 200));
      r.on("error", () => res(false)); r.on("timeout", () => { r.destroy(); res(false); });
    });
    process.stdout.write(`\r  [${i + 1}/20] PostHog: ${ok ? "✓ healthy" : "waiting..."}          `);
    if (ok) { console.log("\n"); break; }
  } catch { process.stdout.write(`\r  [${i + 1}/20] waiting...          `); }
}

console.log(`
╔══════════════════════════════════════════════════════╗
║          PostHog Session Fix Complete                ║
╠══════════════════════════════════════════════════════╣
║  URL:      http://posthog.service.coxa.live:8000
║  Login:    admin@coxa.local
║  Password: CoxaSecureAdmin2026!
║  Session fix: SECURE_COOKIES=0 + DJANGO_ALLOWED_HOSTS=*
╚══════════════════════════════════════════════════════╝
`);
