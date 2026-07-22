/**
 * ec2-docker-start.mjs
 * Uses AWS SSM SendCommand to run Docker startup commands on EC2.
 * Starts tracardi-gui, restarts Caddy for HTTPS certs, checks all services.
 */
import crypto from "crypto";
import https from "https";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const KEY_ID     = requireEnv("AWS_ACCESS_KEY_ID");
const SECRET     = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION     = envOr("AWS_REGION", "us-east-1");
const INSTANCE   = requireEnv("EC2_INSTANCE_ID");
const WORK_DIR   = envOr("EC2_WORK_DIR", "/home/ubuntu/coxa-1touch");

function hmac(key, data) { return crypto.createHmac("sha256", key).update(data).digest(); }
function hash(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac("AWS4" + secret, date), region), service), "aws4_request");
}

function awsRequest(service, host, method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const now    = new Date();
    const amzdt  = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const ds     = amzdt.slice(0, 8);
    const ph     = hash(body);
    const ct     = "application/x-amz-json-1.1";

    const headers = { "content-type": ct, "host": host, "x-amz-date": amzdt, ...extraHeaders };
    const sh      = Object.keys(headers).sort().join(";");
    const hs      = Object.keys(headers).sort().map(k => `${k}:${headers[k]}`).join("\n") + "\n";

    const cr  = [method, path, "", hs, sh, ph].join("\n");
    const cs  = `${ds}/${REGION}/${service}/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256", amzdt, cs, hash(cr)].join("\n");
    const sig = crypto.createHmac("sha256", signingKey(SECRET, ds, REGION, service)).update(sts).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${cs},SignedHeaders=${sh},Signature=${sig}`;

    const reqHeaders = {};
    Object.keys(headers).forEach(k => reqHeaders[k] = headers[k]);
    reqHeaders["Authorization"] = auth;
    reqHeaders["Content-Length"] = Buffer.byteLength(body).toString();

    const req = https.request({ hostname: host, path, method, headers: reqHeaders }, (res) => {
      let buf = ""; res.on("data", c => buf += c); res.on("end", () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function ssmRequest(action, payload) {
  const host = `ssm.${REGION}.amazonaws.com`;
  return awsRequest("ssm", host, "POST", "/", JSON.stringify(payload), { "x-amz-target": `AmazonSSM.${action}` });
}

async function sendCommand(commands) {
  console.log("\n📡 Sending SSM command to EC2...");
  const resp = await ssmRequest("SendCommand", {
    InstanceIds: [INSTANCE],
    DocumentName: "AWS-RunShellScript",
    Parameters: { commands },
    TimeoutSeconds: 300,
    Comment: "Coxa CDP Docker start",
  });

  if (resp.status !== 200) {
    const err = JSON.parse(resp.body);
    throw new Error(`SSM SendCommand failed: ${err.message || resp.body}`);
  }

  const result = JSON.parse(resp.body);
  const cmdId  = result.Command?.CommandId;
  console.log(`   CommandId: ${cmdId}`);
  return cmdId;
}

async function waitForCommand(cmdId, maxWait = 180000) {
  console.log("⏳ Waiting for command to complete...");
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 5000));

    const resp = await ssmRequest("GetCommandInvocation", {
      CommandId: cmdId,
      InstanceId: INSTANCE,
    });

    if (resp.status !== 200) {
      const err = JSON.parse(resp.body);
      if (err.__type?.includes("InvocationDoesNotExist")) {
        process.stdout.write(".");
        continue;
      }
      throw new Error(`GetCommandInvocation failed: ${err.message || resp.body}`);
    }

    const inv = JSON.parse(resp.body);
    const status = inv.StatusDetails;

    if (["Success", "Failed", "TimedOut", "Cancelled"].includes(status)) {
      console.log(`\n   Status: ${status}`);
      console.log("\n─── STDOUT ──────────────────────────────────────────────");
      console.log(inv.StandardOutputContent || "(empty)");
      if (inv.StandardErrorContent?.trim()) {
        console.log("\n─── STDERR ──────────────────────────────────────────────");
        console.log(inv.StandardErrorContent);
      }
      return status === "Success";
    }

    process.stdout.write(`  [${status}]`);
  }

  throw new Error("Command timed out after " + (maxWait / 1000) + "s");
}

// ── Build the shell commands ──────────────────────────────────────────────────

const COMMANDS = [
  "set -e",
  `cd ${WORK_DIR}`,
  "echo '=== EC2 Disk & Docker health ==='",
  "df -h / | tail -1",
  "docker ps --format 'table {{.Names}}\\t{{.Status}}' 2>/dev/null | head -30",

  "echo ''",
  "echo '=== Pulling tracardi-gui image ==='",
  "docker compose -f docker-compose.tracardi.yml --env-file .env.cdp pull tracardi-gui 2>&1 || true",

  "echo ''",
  "echo '=== Starting / recreating Tracardi stack (with GUI) ==='",
  "docker compose -f docker-compose.tracardi.yml --env-file .env.cdp up -d --remove-orphans 2>&1",

  "echo ''",
  "echo '=== Restarting Caddy to pick up new Tracardi virtual hosts ==='",
  "docker compose -f docker-compose.cdp.yml --env-file .env.cdp restart posthog-proxy 2>&1",

  "echo ''",
  "echo '=== Waiting 15s for Caddy to obtain Let'\\''s Encrypt certs... ==='",
  "sleep 15",

  "echo ''",
  "echo '=== Final container status ==='",
  "docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null",

  "echo ''",
  "echo '=== Testing HTTPS endpoints (may take a moment for cert issuance) ==='",
  "curl -sk -o /dev/null -w 'posthog:           %{http_code}\\n' https://posthog.service.coxa.live/api/users/@me/ || true",
  "curl -sk -o /dev/null -w 'tracardi GUI:      %{http_code}\\n' https://tracardi.service.coxa.live/ || true",
  "curl -sk -o /dev/null -w 'tracardi API:      %{http_code}\\n' https://tracardi-api.service.coxa.live/healthcheck || true",

  "echo ''",
  "echo '✅ All done'",
];

// ── Run ───────────────────────────────────────────────────────────────────────
try {
  const cmdId = await sendCommand(COMMANDS);
  const ok    = await waitForCommand(cmdId, 240000);
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
}
