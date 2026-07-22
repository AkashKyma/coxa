/**
 * Links posthog.service.coxa.live → EC2 instance via Route 53 A record.
 * Then updates POSTHOG_SITE_URL in docker-compose and all .env files.
 * Optionally enables Caddy HTTPS with Let's Encrypt for the domain.
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
const EC2_IP = envOr("EC2_IP_POSTHOG_SETUP", requireEnv("EC2_PUBLIC_IP"));
const DOMAIN = envOr("POSTHOG_DOMAIN", "posthog.service.coxa.live");

function sign(key, msg) { return crypto.createHmac("sha256", key).update(msg).digest(); }
function signingKey(s, d, r, svc) { return sign(sign(sign(sign("AWS4" + s, d), r), svc), "aws4_request"); }

function r53Request(method, path, body = "") {
  return new Promise((resolve, reject) => {
    const host = "route53.amazonaws.com";
    const now = new Date();
    const amz = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const ds = amz.slice(0, 8);
    const contentType = body ? "application/xml" : "";
    const ph = crypto.createHash("sha256").update(body).digest("hex");

    const headersToSign = body
      ? `content-type:${contentType}\nhost:${host}\nx-amz-date:${amz}\n`
      : `host:${host}\nx-amz-date:${amz}\n`;
    const sh = body ? "content-type;host;x-amz-date" : "host;x-amz-date";

    const cr = [method, path, "", headersToSign, sh, ph].join("\n");
    const cs = `${ds}/us-east-1/route53/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256", amz, cs,
      crypto.createHash("sha256").update(cr).digest("hex")].join("\n");
    const sk = signingKey(SECRET, ds, "us-east-1", "route53");
    const sig = crypto.createHmac("sha256", sk).update(sts).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${cs}, SignedHeaders=${sh}, Signature=${sig}`;

    const reqHeaders = {
      Host: host,
      "X-Amz-Date": amz,
      Authorization: auth,
    };
    if (body) {
      reqHeaders["Content-Type"] = contentType;
      reqHeaders["Content-Length"] = Buffer.byteLength(body);
    }

    const req = https.request(
      { hostname: host, path, method, headers: reqHeaders },
      (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => resolve({ status: r.statusCode, body: d })); }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function xmlVal(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}
function xmlAll(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map(m => m[1].trim());
}

// ── 1. List hosted zones ──────────────────────────────────────────────────
console.log("=== Finding Route 53 Hosted Zone for coxa.live ===");
const zonesResp = await r53Request("GET", "/2013-04-01/hostedzone");

if (zonesResp.status !== 200) {
  console.error("Failed to list hosted zones:", zonesResp.body.slice(0, 300));
  process.exit(1);
}

const zoneIds = xmlAll(zonesResp.body, "Id");
const zoneNames = xmlAll(zonesResp.body, "Name");

console.log("Hosted zones found:");
zoneIds.forEach((id, i) => console.log(`  ${zoneNames[i]}  →  ${id}`));

const coxaIdx = zoneNames.findIndex(n => n.includes("coxa.live"));
if (coxaIdx === -1) {
  console.error("\n✗ No hosted zone found for coxa.live");
  console.log("Available zones:", zoneNames.join(", "));
  process.exit(1);
}

const rawZoneId = zoneIds[coxaIdx];
const zoneId = rawZoneId.replace("/hostedzone/", "");
console.log(`\n✓ Found: ${zoneNames[coxaIdx]}  zoneId: ${zoneId}`);

// ── 2. Check if record already exists ────────────────────────────────────
console.log(`\n=== Checking existing records for ${DOMAIN} ===`);
const listResp = await r53Request(
  "GET",
  `/2013-04-01/hostedzone/${zoneId}/rrset?name=${DOMAIN}&type=A&maxitems=1`
);
const existingIp = xmlVal(listResp.body, "Value");
if (existingIp) {
  console.log(`Existing A record: ${DOMAIN} → ${existingIp}`);
  if (existingIp === EC2_IP) {
    console.log("Already pointing to current EC2 IP. Nothing to update for DNS.");
  }
} else {
  console.log("No existing A record found — will create new.");
}

// ── 3. Create / update A record ───────────────────────────────────────────
console.log(`\n=== Creating A record: ${DOMAIN} → ${EC2_IP} ===`);
const changeXml = `<?xml version="1.0" encoding="UTF-8"?>
<ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <ChangeBatch>
    <Comment>PostHog CDP subdomain for Coxa platform</Comment>
    <Changes>
      <Change>
        <Action>UPSERT</Action>
        <ResourceRecordSet>
          <Name>${DOMAIN}</Name>
          <Type>A</Type>
          <TTL>300</TTL>
          <ResourceRecords>
            <ResourceRecord>
              <Value>${EC2_IP}</Value>
            </ResourceRecord>
          </ResourceRecords>
        </ResourceRecordSet>
      </Change>
    </Changes>
  </ChangeBatch>
</ChangeResourceRecordSetsRequest>`;

const changeResp = await r53Request(
  "POST",
  `/2013-04-01/hostedzone/${zoneId}/rrset`,
  changeXml
);

if (changeResp.status !== 200 && changeResp.status !== 201) {
  console.error(`Failed to create DNS record (HTTP ${changeResp.status}):`);
  console.error(changeResp.body.slice(0, 400));
  process.exit(1);
}

const changeId = xmlVal(changeResp.body, "Id");
const changeStatus = xmlVal(changeResp.body, "Status");
console.log(`✓ DNS change submitted. ID: ${changeId}  Status: ${changeStatus}`);
console.log("  (DNS propagates globally in ~60 seconds, TTL=300s)");

// ── 4. Update POSTHOG_SITE_URL in all env files ──────────────────────────
console.log(`\n=== Updating POSTHOG_SITE_URL to http://${DOMAIN}:8000 ===`);

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
    // Update POSTHOG_HOST and RUDDERSTACK_DATA_PLANE_URL to use domain
    let updated = c
      .replace(/POSTHOG_HOST=http:\/\/[\d.]+:8000/g, `POSTHOG_HOST=http://${DOMAIN}:8000`)
      .replace(/POSTHOG_SITE_URL=http:\/\/[\d.]+:8000/g, `POSTHOG_SITE_URL=http://${DOMAIN}:8000`);
    if (updated !== c) { writeFileSync(f, updated); console.log(`  ✓ ${f.replace(COXA_DIR, "")}`); }
  } catch { /* skip */ }
}

// ── 5. Print what Abhishek needs to run to apply SITE_URL on EC2 ─────────
console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Route 53 DNS Record Created Successfully             ║
╠══════════════════════════════════════════════════════════════╣
║  Domain:       ${DOMAIN.padEnd(47)}║
║  Points to:    ${EC2_IP.padEnd(47)}║
║  PostHog URL:  http://${DOMAIN}:8000
╠══════════════════════════════════════════════════════════════╣
║  ACTION NEEDED — run on EC2 (via Instance Connect):          ║
║                                                              ║
║  cd ~/coxa                                                   ║
║  sed -i 's|POSTHOG_SITE_URL=.*|POSTHOG_SITE_URL=http://${DOMAIN}:8000|g' .env.cdp
║  docker compose -f docker-compose.cdp.yml up -d --no-deps --force-recreate posthog
╚══════════════════════════════════════════════════════════════╝
`);
