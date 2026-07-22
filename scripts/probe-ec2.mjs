/**
 * Minimal AWS EC2 DescribeInstances + connectivity probe
 * Uses built-in https + crypto — zero dependencies.
 */
import crypto from "crypto";
import https from "https";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const AWS_ACCESS_KEY = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");

function hmac(key, data, enc) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(enc || undefined);
}
function hash(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

async function ec2Request(region, action, params = {}) {
  const host = `ec2.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const allParams = { Action: action, Version: "2016-11-15", ...params };
  const body = Object.keys(allParams).sort().map(k =>
    encodeURIComponent(k) + "=" + encodeURIComponent(allParams[k])
  ).join("&");

  const payloadHash = hash(body);
  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credScope = `${dateStamp}/${region}/ec2/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${hash(canonicalRequest)}`;

  const signingKey = hmac(hmac(hmac(hmac("AWS4" + AWS_SECRET_KEY, dateStamp), region), "ec2"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: "/",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Amz-Date": amzDate,
        "Authorization": authHeader,
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function probePort(host, port, timeout = 3000) {
  const { createConnection } = await import("net");
  return new Promise((resolve) => {
    const sock = createConnection({ host, port, timeout });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
  });
}

// Try multiple regions to find the instance
const REGIONS = ["ap-south-1", "us-east-1", "eu-west-1", "ap-southeast-1"];

console.log("\n═══════════════════════════════════════════════════");
console.log(" Coxa EC2 Connectivity Probe");
console.log("═══════════════════════════════════════════════════\n");

let instanceInfo = null;

for (const region of REGIONS) {
  process.stdout.write(`Checking region ${region}... `);
  try {
    const res = await ec2Request(region, "DescribeInstances", {
      "Filter.1.Name": "instance-id",
      "Filter.1.Value.1": INSTANCE_ID,
    });

    if (res.status === 200 && res.body.includes(INSTANCE_ID)) {
      console.log("FOUND ✓");

      // Parse key fields from XML response
      const get = (tag) => {
        const m = res.body.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
        return m ? m[1] : "N/A";
      };

      instanceInfo = {
        region,
        state: get("name"),
        publicIp: get("ipAddress"),
        privateIp: get("privateIpAddress"),
        publicDns: get("publicDnsName"),
        instanceType: get("instanceType"),
      };
      break;
    } else if (res.body.includes("AuthFailure") || res.body.includes("InvalidClientTokenId")) {
      console.log("Auth error");
      console.error("AWS credential error:", res.body.slice(0, 300));
      process.exit(1);
    } else {
      console.log("not in this region");
    }
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
}

if (!instanceInfo) {
  console.error("\n✗ Instance not found in any region checked.");
  process.exit(1);
}

console.log("\n─── Instance Details ───────────────────────────────");
console.log(`  Region:        ${instanceInfo.region}`);
console.log(`  State:         ${instanceInfo.state}`);
console.log(`  Type:          ${instanceInfo.instanceType}`);
console.log(`  Public IP:     ${instanceInfo.publicIp}`);
console.log(`  Private IP:    ${instanceInfo.privateIp}`);
console.log(`  Public DNS:    ${instanceInfo.publicDns}`);

if (instanceInfo.publicIp === "N/A") {
  console.log("\n⚠ No public IP — instance may be stopped or in a private subnet.");
  process.exit(0);
}

const ip = instanceInfo.publicIp;

console.log(`\n─── Port Connectivity to ${ip} ──────────────────────`);

const PORTS = [
  { port: 22,   label: "SSH" },
  { port: 80,   label: "HTTP / Caddy" },
  { port: 443,  label: "HTTPS / Caddy" },
  { port: 8080, label: "RudderStack data-plane" },
  { port: 9090, label: "RudderStack transformer" },
  { port: 8000, label: "PostHog" },
  { port: 5000, label: "Coxa backend API" },
  { port: 5433, label: "RudderStack DB (postgres)" },
  // Phase 2 — intentionally internal only (should show closed/blocked externally)
  { port: 8123, label: "ClickHouse HTTP     [internal]" },
  { port: 9000, label: "ClickHouse TCP      [internal]" },
  { port: 4000, label: "Cube API            [internal]" },
  { port: 3030, label: "Dagster UI          [internal]" },
];

for (const { port, label } of PORTS) {
  const open = await probePort(ip, port);
  console.log(`  ${String(port).padEnd(5)} ${label.padEnd(32)} ${open ? "✓ OPEN" : "✗ closed/blocked"}`);
}

console.log("\n─── Environment Config Needed ──────────────────────");
console.log(`  # Add to backend/.env`);
console.log(`  RUDDERSTACK_DATA_PLANE_URL=http://${ip}:8080`);
console.log(`  RUDDERSTACK_BACKEND_WRITE_KEY=rbs_36b0b76d1de95af77a05ca30fc46328cf70b07af`);
console.log(`  POSTHOG_HOST=https://posthog.service.coxa.live`);
console.log(`  POSTHOG_PROJECT_API_KEY=<get from PostHog UI>`);
console.log(`  # Phase 2 (accessed via localhost on EC2 — not public)`);
console.log(`  CUBE_API_URL=http://localhost:4000/cubejs-api/v1`);
console.log(`  CUBE_API_SECRET=coxa-cube-dev-secret-change-in-prod`);
console.log(`  CLICKHOUSE_HOST=localhost`);
console.log(`  CLICKHOUSE_PORT=9000`);
console.log(`  CLICKHOUSE_DATABASE=coxa`);
console.log(`\n  # Add to each frontend .env`);
console.log(`  VITE_RUDDERSTACK_WRITE_KEY=rws_2cb392007d9b69839f418856bfa09a7d2e296419`);
console.log(`  VITE_RUDDERSTACK_DATA_PLANE_URL=http://${ip}:8080`);
console.log(`  VITE_POSTHOG_KEY=<get from PostHog UI>`);
console.log(`  VITE_POSTHOG_HOST=https://posthog.service.coxa.live`);
console.log("\n═══════════════════════════════════════════════════\n");
