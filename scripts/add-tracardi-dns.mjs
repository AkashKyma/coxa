/**
 * add-tracardi-dns.mjs
 *
 * Creates Route 53 A records for:
 *   tracardi.service.coxa.live     → EC2 Elastic IP (Tracardi GUI via Caddy HTTPS)
 *   tracardi-api.service.coxa.live → EC2 Elastic IP (Tracardi API via Caddy HTTPS)
 *
 * Run:
 *   node scripts/add-tracardi-dns.mjs
 *
 * Requires AWS credentials with route53:ChangeResourceRecordSets permission.
 */

import https from "https";
import crypto from "crypto";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const KEY_ID = requireEnv("AWS_ACCESS_KEY_ID");
const SECRET  = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION  = envOr("AWS_REGION", "us-east-1");
const EC2_IP  = requireEnv("EC2_ELASTIC_IP");

const RECORDS = [
  { domain: envOr("TRACARDI_DOMAIN", "tracardi.service.coxa.live"),     comment: "Tracardi GUI (visual segment builder) via Caddy HTTPS" },
  { domain: envOr("TRACARDI_API_DOMAIN", "tracardi-api.service.coxa.live"), comment: "Tracardi API via Caddy HTTPS" },
];

// ── SigV4 helpers ─────────────────────────────────────────────────────────────
function sign(key, msg) { return crypto.createHmac("sha256", key).update(msg).digest(); }
function signingKey(s, d, r, svc) { return sign(sign(sign(sign("AWS4" + s, d), r), svc), "aws4_request"); }

function r53Request(method, path, body = "") {
  return new Promise((resolve, reject) => {
    const host = "route53.amazonaws.com";
    const now  = new Date();
    const amz  = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const ds   = amz.slice(0, 8);
    const ct   = body ? "application/xml" : "";
    const ph   = crypto.createHash("sha256").update(body).digest("hex");

    const headersToSign = body
      ? `content-type:${ct}\nhost:${host}\nx-amz-date:${amz}\n`
      : `host:${host}\nx-amz-date:${amz}\n`;
    const sh = body ? "content-type;host;x-amz-date" : "host;x-amz-date";

    const cr  = [method, path, "", headersToSign, sh, ph].join("\n");
    const cs  = `${ds}/${REGION}/route53/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256", amz, cs, crypto.createHash("sha256").update(cr).digest("hex")].join("\n");
    const sig = crypto.createHmac("sha256", signingKey(SECRET, ds, REGION, "route53")).update(sts).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${cs},SignedHeaders=${sh},Signature=${sig}`;

    const reqHeaders = {
      Host: host,
      "X-Amz-Date": amz,
      Authorization: auth,
      ...(body && { "Content-Type": ct, "Content-Length": Buffer.byteLength(body).toString() }),
    };

    const req = https.request({ hostname: host, path, method, headers: reqHeaders }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end",  () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function xmlVal(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return m ? m[1] : null;
}
function xmlAll(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "g"))].map((m) => m[1]);
}

// ── 1. Find hosted zone ───────────────────────────────────────────────────────
console.log("=== Finding coxa.live hosted zone ===");
const zonesResp = await r53Request("GET", "/2013-04-01/hostedzone");
if (zonesResp.status !== 200) {
  console.error("Failed to list hosted zones:", zonesResp.body);
  process.exit(1);
}

const zoneIds   = xmlAll(zonesResp.body, "Id");
const zoneNames = xmlAll(zonesResp.body, "Name");
const coxaIdx   = zoneNames.findIndex((n) => n.includes("coxa.live"));

if (coxaIdx === -1) {
  console.error("✗ No hosted zone found for coxa.live. Available:", zoneNames.join(", "));
  process.exit(1);
}

const zoneId = zoneIds[coxaIdx].replace("/hostedzone/", "");
console.log(`✓ Zone: ${zoneNames[coxaIdx]}  →  ${zoneId}\n`);

// ── 2. Upsert both A records ──────────────────────────────────────────────────
for (const { domain, comment } of RECORDS) {
  console.log(`=== Creating A record: ${domain} → ${EC2_IP} ===`);

  const changeXml = `<?xml version="1.0" encoding="UTF-8"?>
<ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <ChangeBatch>
    <Comment>${comment}</Comment>
    <Changes>
      <Change>
        <Action>UPSERT</Action>
        <ResourceRecordSet>
          <Name>${domain}</Name>
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

  const resp = await r53Request("POST", `/2013-04-01/hostedzone/${zoneId}/rrset`, changeXml);

  if (resp.status === 200 || resp.status === 201) {
    const changeId = xmlVal(resp.body, "Id");
    console.log(`✓ DNS record queued  changeId: ${changeId}`);
    console.log(`  Propagation: ~30–60 seconds\n`);
  } else {
    console.error(`✗ Failed (HTTP ${resp.status}):`);
    console.error(resp.body);
  }
}

console.log("=== All records submitted ===");
console.log("After ~60s, verify with:");
RECORDS.forEach(({ domain }) => console.log(`  nslookup ${domain}`));
console.log("\nOnce DNS resolves, restart Caddy on EC2 to issue Let's Encrypt certs:");
console.log("  docker compose -f docker-compose.cdp.yml restart posthog-proxy");
