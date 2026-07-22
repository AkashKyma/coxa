/**
 * Upgrades the Coxa CDP EC2 instance from t3.medium to t3.large.
 * Steps: stop → modify instance type → start → patch .env files + Route 53 → verify PostHog health.
 */
import https from "https";
import http from "http";
import net from "net";
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
const DOMAIN = envOr("POSTHOG_DOMAIN", "posthog.service.coxa.live");
const ZONE_ID = requireEnv("ROUTE53_ZONE_ID");
const TARGET_TYPE = envOr("EC2_TARGET_TYPE", "t3.large");

function sign(key, msg) { return crypto.createHmac("sha256", key).update(msg).digest(); }
function signingKey(s, d, r, svc) { return sign(sign(sign(sign("AWS4" + s, d), r), svc), "aws4_request"); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ec2(action, extra = {}) {
  return new Promise((res, rej) => {
    const body = new URLSearchParams({ Action: action, Version: "2016-11-15", ...extra }).toString();
    const host = `ec2.${REGION}.amazonaws.com`;
    const now = new Date();
    const amz = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const ds = amz.slice(0, 8);
    const ph = crypto.createHash("sha256").update(body).digest("hex");
    const ch = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amz}\n`;
    const sh = "content-type;host;x-amz-date";
    const cr = ["POST", "/", "", ch, sh, ph].join("\n");
    const cs = `${ds}/${REGION}/ec2/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256", amz, cs, crypto.createHash("sha256").update(cr).digest("hex")].join("\n");
    const sk = signingKey(SECRET, ds, REGION, "ec2");
    const sig = crypto.createHmac("sha256", sk).update(sts).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${cs}, SignedHeaders=${sh}, Signature=${sig}`;
    const req = https.request({ hostname: host, path: "/", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Amz-Date": amz, Authorization: auth, "Content-Length": Buffer.byteLength(body) } },
      r => { let d = ""; r.on("data", c => d += c); r.on("end", () => res({ status: r.statusCode, body: d })); });
    req.on("error", rej); req.write(body); req.end();
  });
}

function parseXml(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

function r53Update(newIp) {
  return new Promise((res) => {
    const body = `<?xml version="1.0" encoding="UTF-8"?><ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/"><ChangeBatch><Changes><Change><Action>UPSERT</Action><ResourceRecordSet><Name>${DOMAIN}</Name><Type>A</Type><TTL>60</TTL><ResourceRecords><ResourceRecord><Value>${newIp}</Value></ResourceRecord></ResourceRecords></ResourceRecordSet></Change></Changes></ChangeBatch></ChangeResourceRecordSetsRequest>`;
    const host = "route53.amazonaws.com";
    const path = `/2013-04-01/hostedzone/${ZONE_ID}/rrset`;
    const now = new Date();
    const amz = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const ds = amz.slice(0, 8);
    const ph = crypto.createHash("sha256").update(body).digest("hex");
    const ch = `content-type:application/xml\nhost:${host}\nx-amz-date:${amz}\n`;
    const shd = "content-type;host;x-amz-date";
    const cr = ["POST", path, "", ch, shd, ph].join("\n");
    const cs = `${ds}/us-east-1/route53/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256", amz, cs, crypto.createHash("sha256").update(cr).digest("hex")].join("\n");
    const sk = signingKey(SECRET, ds, "us-east-1", "route53");
    const sig = crypto.createHmac("sha256", sk).update(sts).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${cs}, SignedHeaders=${shd}, Signature=${sig}`;
    const req = https.request({ hostname: host, path, method: "POST",
      headers: { "Content-Type": "application/xml", "X-Amz-Date": amz, Authorization: auth, "Content-Length": Buffer.byteLength(body) } },
      r => { let d = ""; r.on("data", c => d += c); r.on("end", () => {
        console.log(d.includes("<Id>") ? `  ✓ Route 53: ${DOMAIN} → ${newIp}` : `  R53 HTTP ${r.statusCode}: ${d.slice(0, 100)}`);
        res();
      }); });
    req.on("error", e => { console.log("R53 err:", e.message); res(); });
    req.write(body); req.end();
  });
}

// ── 1. Check current state ────────────────────────────────────────────────────
console.log("Checking current instance state...");
const descR = await ec2("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
let state = parseXml(descR.body, "name");
let currentIp = parseXml(descR.body, "ipAddress");
const currentType = descR.body.match(/<instanceType>([^<]+)<\/instanceType>/)?.[1];
console.log(`  State: ${state}  IP: ${currentIp}  Type: ${currentType}`);

if (currentType === TARGET_TYPE) {
  console.log(`\nInstance is already ${TARGET_TYPE}. No upgrade needed.`);
  process.exit(0);
}

// ── 2. Stop the instance ──────────────────────────────────────────────────────
if (state === "running") {
  console.log(`\nStopping instance (${state} → stopped)...`);
  await ec2("StopInstances", { "InstanceId.1": INSTANCE_ID });
  for (let i = 0; i < 30; i++) {
    await sleep(8000);
    const d = await ec2("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
    state = parseXml(d.body, "name");
    process.stdout.write(`\r  ${state}...          `);
    if (state === "stopped") { console.log("\n  Stopped."); break; }
  }
} else if (state === "stopped") {
  console.log("Instance already stopped.");
} else {
  console.error(`Unexpected state: ${state}. Stop it manually and retry.`);
  process.exit(1);
}

// ── 3. Modify instance type ───────────────────────────────────────────────────
process.stdout.write(`\nUpgrading ${currentType} → ${TARGET_TYPE}... `);
const modR = await ec2("ModifyInstanceAttribute", {
  InstanceId: INSTANCE_ID,
  "InstanceType.Value": TARGET_TYPE
});
if (modR.status !== 200) {
  console.error(`FAILED (HTTP ${modR.status}):\n${modR.body.slice(0, 300)}`);
  process.exit(1);
}
console.log("done.");

// ── 4. Start the instance ─────────────────────────────────────────────────────
process.stdout.write("Starting instance... ");
await ec2("StartInstances", { "InstanceId.1": INSTANCE_ID });

let newIp = null;
for (let i = 0; i < 30; i++) {
  await sleep(8000);
  const d = await ec2("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  state = parseXml(d.body, "name");
  newIp = parseXml(d.body, "ipAddress");
  const newType = d.body.match(/<instanceType>([^<]+)<\/instanceType>/)?.[1];
  process.stdout.write(`\r  ${state}  IP=${newIp ?? "..."}  type=${newType ?? "..."}          `);
  if (state === "running" && newIp) { console.log(`\n  Up on ${TARGET_TYPE}.`); break; }
}

if (!newIp) { console.error("Instance did not start in time."); process.exit(1); }

// ── 5. Patch .env files & Route 53 ───────────────────────────────────────────
console.log(`\nNew IP: ${newIp}${newIp === currentIp ? " (unchanged)" : ` (was ${currentIp})`}`);

if (newIp !== currentIp) {
  const envFiles = [
    join(COXA_DIR, ".env"),
    join(COXA_DIR, "apps/fan-auth/.env"),
    join(COXA_DIR, "apps/fan-dashboard/.env"),
    join(COXA_DIR, "apps/fan-landing/.env"),
    join(COXA_DIR, "apps/club-dashboard/.env"),
    join(COXA_DIR, "backend/.env.elb.example"),
    join(COXA_DIR, "infrastructure/.env.cdp.example"),
  ];
  for (const f of envFiles) {
    try {
      let c = readFileSync(f, "utf8");
      const u = c.replace(new RegExp(currentIp.replace(/\./g, "\\."), "g"), newIp);
      if (u !== c) { writeFileSync(f, u); console.log(`  ✓ ${f.replace(COXA_DIR, "")}`); }
    } catch { /* skip missing files */ }
  }
  await r53Update(newIp);
} else {
  console.log("IP unchanged — skipping .env patching and Route 53 update.");
}

// ── 6. Wait for PostHog health ────────────────────────────────────────────────
console.log(`\nWaiting for PostHog to be healthy at http://${newIp}:8000/_health...`);
let posthogOk = false;
for (let i = 0; i < 40; i++) {
  await sleep(15000);
  const ph = await new Promise(res => {
    http.get(`http://${newIp}:8000/_health`, { timeout: 6000 }, r => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => res(r.statusCode));
    }).on("error", () => res(0)).on("timeout", () => res(0));
  });
  const elapsed = Math.round((i + 1) * 15 / 60 * 10) / 10;
  process.stdout.write(`\r  [${i + 1}/40] ${elapsed}min  posthog=${ph === 200 ? "✓ HEALTHY" : "waiting..."}          `);
  if (ph === 200) { posthogOk = true; console.log("\n"); break; }
}

// ── 7. Summary ────────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Instance upgraded: ${currentType ?? "unknown"} → ${TARGET_TYPE}
║  Instance ID:       ${INSTANCE_ID}
║  Public IP:         ${newIp}
║  PostHog:           http://${newIp}:8000  ${posthogOk ? "✓" : "⚠ not healthy yet"}
║  HTTPS:             https://${DOMAIN}
╚══════════════════════════════════════════════════════════════╝
${posthogOk
  ? "✓ Upgrade complete. Ready for Phase 2 service deployment."
  : "⚠ PostHog not healthy yet — give it a few more minutes then check:\n  curl http://" + newIp + ":8000/_health"}
`);
