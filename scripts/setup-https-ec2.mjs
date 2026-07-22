/**
 * Adds HTTPS via standalone Caddy SSL container with network_mode:host.
 * Minimal boot script — no apt-get, no AWS CLI, just Docker + Caddy.
 * DNS auto-updater uses openssl/curl SigV4 (no dependencies).
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

function sign(key, msg) { return crypto.createHmac("sha256", key).update(msg).digest(); }
function signingKey(s, d, r, svc) { return sign(sign(sign(sign("AWS4" + s, d), r), svc), "aws4_request"); }

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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
        console.log(d.includes("<Id>") ? `  ✓ Route 53: ${DOMAIN} → ${newIp}` : `  R53 HTTP ${r.statusCode}: ${d.slice(0,100)}`);
        res();
      }); });
    req.on("error", e => { console.log("R53 err:", e.message); res(); });
    req.write(body); req.end();
  });
}

// ── Caddy compose: network_mode:host — binds directly to host ports 80/443 ──
const HTTPS_COMPOSE = `services:
  caddy-ssl:
    image: caddy:2-alpine
    network_mode: host
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    command: ["caddy", "reverse-proxy", "--from", "${DOMAIN}", "--to", "localhost:8000"]
    restart: unless-stopped
volumes:
  caddy_data:
  caddy_config:
`;
const composeB64 = Buffer.from(HTTPS_COMPOSE).toString("base64");

// ── Minimal boot script — uses `docker run` directly (no compose in root PATH issue) ──
const BOOT_SCRIPT = `#!/bin/bash
LOG=/var/log/coxa-caddy.log
exec >> "\$LOG" 2>&1
echo "[\$(date)] Caddy HTTPS setup starting"

# Wait for Docker daemon (up to 200s)
for i in \$(seq 1 40); do
  docker info >/dev/null 2>&1 && break
  echo "  waiting for docker \$i..."
  sleep 5
done
echo "[\$(date)] Docker ready. Running containers:"
docker ps --format "{{.Names}} {{.Status}}"

# Remove any old caddy-ssl container
docker rm -f caddy-ssl 2>/dev/null || true

# Create named volumes if they don't exist
docker volume create caddy_data >/dev/null 2>&1 || true
docker volume create caddy_config >/dev/null 2>&1 || true

# Start Caddy SSL using docker run (no compose dependency)
docker run -d \\
  --name caddy-ssl \\
  --network host \\
  --volume caddy_data:/data \\
  --volume caddy_config:/config \\
  --restart unless-stopped \\
  caddy:2-alpine \\
  caddy reverse-proxy --from ${DOMAIN} --to localhost:8000

echo "[\$(date)] Caddy container launched:"
docker ps | grep caddy || echo "caddy not in docker ps"

sleep 40
echo "[\$(date)] Port checks:"
ss -tlnp | grep -E ':80|:443' || echo "ports 80/443 not listening"
echo "[\$(date)] HTTPS: \$(curl -sk -o /dev/null -w '%{http_code}' https://localhost/_health || echo 0)"
echo "[\$(date)] COMPLETE"
`;

const encoded = Buffer.from(BOOT_SCRIPT).toString("base64");
console.log(`Compose: ${composeB64.length}B  Boot script: ${encoded.length}B (limit:25600)`);
if (encoded.length > 25600) { console.error("TOO LARGE"); process.exit(1); }
console.log("Size OK ✓");

// ── EC2 stop/inject/start ─────────────────────────────────────────────────
const descR = await ec2("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
let state = parseXml(descR.body, "name");
let ip = parseXml(descR.body, "ipAddress");
console.log(`\nEC2: state=${state}  IP=${ip}`);

if (state === "running") {
  process.stdout.write("Stopping... ");
  await ec2("StopInstances", { "InstanceId.1": INSTANCE_ID });
  for (let i = 0; i < 30; i++) {
    await sleep(8000);
    state = parseXml((await ec2("DescribeInstances", { "InstanceId.1": INSTANCE_ID })).body, "name");
    process.stdout.write(`\r  ${state}          `);
    if (state === "stopped") { console.log("\n  Stopped."); break; }
  }
}

process.stdout.write("Injecting... ");
const mr = await ec2("ModifyInstanceAttribute", { InstanceId: INSTANCE_ID, "UserData.Value": encoded });
if (mr.status !== 200) { console.error("FAILED:", mr.body.slice(0,200)); process.exit(1); }
console.log("done.");

process.stdout.write("Starting... ");
await ec2("StartInstances", { "InstanceId.1": INSTANCE_ID });
let newIp = null;
for (let i = 0; i < 30; i++) {
  await sleep(8000);
  const d = await ec2("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  state = parseXml(d.body, "name");
  newIp = parseXml(d.body, "ipAddress");
  process.stdout.write(`\r  ${state}  IP=${newIp ?? "..."}          `);
  if (state === "running" && newIp) { console.log(`\n  Up. New IP: ${newIp}`); break; }
}

// ── Update .env files ─────────────────────────────────────────────────────
const envFiles = [join(COXA_DIR, ".env"), join(COXA_DIR, "apps/fan-auth/.env"),
  join(COXA_DIR, "apps/fan-dashboard/.env"), join(COXA_DIR, "apps/fan-landing/.env"),
  join(COXA_DIR, "apps/club-dashboard/.env"), join(COXA_DIR, "backend/.env.elb.example"),
  join(COXA_DIR, "infrastructure/.env.cdp.example")];
for (const f of envFiles) {
  try {
    let c = readFileSync(f, "utf8");
    const u = c.replace(/(\d{1,3}\.){3}\d{1,3}(?=:\d{4})/g, newIp);
    if (u !== c) { writeFileSync(f, u); console.log(`  ✓ ${f.replace(COXA_DIR, "")}`); }
  } catch { /* skip */ }
}
await r53Update(newIp);

// ── Poll for HTTPS (boot script needs ~2 min) ─────────────────────────────
console.log(`\nPolling https://${DOMAIN} (up to 5 min)...\n`);
let httpsOk = false;
for (let i = 0; i < 30; i++) {
  await sleep(10000);
  const ph = await new Promise(res => {
    http.get(`http://${newIp}:8000/_health`, {timeout:5000}, r => {
      let d=""; r.on("data",c=>d+=c); r.on("end",()=>res(r.statusCode));
    }).on("error",()=>res(0)).on("timeout",()=>res(0));
  });
  const hts = await new Promise(res => {
    const req = https.get(`https://${DOMAIN}/_health`, {timeout:8000, rejectUnauthorized:false}, r => {
      let d=""; r.on("data",c=>d+=c); r.on("end",()=>res(r.statusCode));
    });
    req.on("error",()=>res(0)); req.on("timeout",()=>{ req.destroy(); res(0); });
  });
  const p443 = await new Promise(res => {
    const s = net.createConnection({host: newIp, port: 443, timeout: 3000});
    s.on("connect",()=>{s.destroy(); res("OPEN");});
    s.on("error",()=>res("closed")); s.on("timeout",()=>{s.destroy(); res("timeout");});
  });
  process.stdout.write(`\r  [${i+1}/30] HTTP=${ph===200?"✓":"wait"}  HTTPS=${hts===200?"✓ LIVE":hts||"wait"}  port443=${p443}          `);
  if (hts === 200) { httpsOk = true; console.log("\n"); break; }
}

console.log(`
╔═══════════════════════════════════════════════════════╗
║  PostHog HTTPS:  https://${DOMAIN}
║  RudderStack:    http://${newIp}:8080
║  Login:          admin@coxa.local / CoxaSecureAdmin2026!
╚═══════════════════════════════════════════════════════╝
${httpsOk ? "✓ HTTPS verified live!" : "⚠ HTTPS pending — check: curl -I https://" + DOMAIN + "/_health"}
`);
