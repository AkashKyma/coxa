/**
 * SSH via EIC Endpoint using OpenSSH ProxyCommand.
 * Requires the EIC Endpoint to be in create-complete state.
 * Uses the AWS open-tunnel API to create a WebSocket tunnel,
 * then pipes SSH through it via the aws ec2-instance-connect open-tunnel command.
 * Since aws CLI is not available, we use a Node.js WebSocket approach.
 */
import crypto from "crypto";
import https from "https";
import { spawnSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const AWS_ACCESS_KEY = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");
const SSH_USER = envOr("EC2_SSH_USER", "ubuntu");
const EIC_ENDPOINT_ID = requireEnv("EIC_ENDPOINT_ID");

function hmac(key, data, enc) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(enc || undefined);
}
function hash(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

async function ec2Request(action, params = {}) {
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const host = `ec2.${REGION}.amazonaws.com`;
  const query = { Action: action, Version: "2016-11-15", ...params };
  const qs = Object.keys(query).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&");
  const ph = hash("");
  const ch = `host:${host}\nx-amz-date:${amzdate}\n`;
  const sh = "host;x-amz-date";
  const cr = ["GET", "/", qs, ch, sh, ph].join("\n");
  const cs = `${datestamp}/${REGION}/ec2/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amzdate}\n${cs}\n${hash(cr)}`;
  const sk = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), "ec2"), "aws4_request");
  const sig = hmac(sk, sts, "hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${cs}, SignedHeaders=${sh}, Signature=${sig}`;
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, path: `/?${qs}`, method: "GET", headers: { "x-amz-date": amzdate, Authorization: auth } }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject); req.end();
  });
}

async function eicPushKey(az, publicKey, endpointId) {
  const body = JSON.stringify({
    InstanceId: INSTANCE_ID,
    InstanceOSUser: SSH_USER,
    SSHPublicKey: publicKey,
    AvailabilityZone: az,
  });
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const host = `ec2-instance-connect.${REGION}.amazonaws.com`;
  const ph = hash(body);
  const ch = `content-type:application/json\nhost:${host}\nx-amz-date:${amzdate}\n`;
  const sh = "content-type;host;x-amz-date";
  const cr = ["POST", "/v1/push-public-key", "", ch, sh, ph].join("\n");
  const cs = `${datestamp}/${REGION}/ec2-instance-connect/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amzdate}\n${cs}\n${hash(cr)}`;
  const sk = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), "ec2-instance-connect"), "aws4_request");
  const sig = hmac(sk, sts, "hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${cs}, SignedHeaders=${sh}, Signature=${sig}`;
  return new Promise((resolve, reject) => {
    const opts = { hostname: host, path: "/v1/push-public-key", method: "POST",
      headers: { "Content-Type": "application/json", "x-amz-date": amzdate, Authorization: auth, "Content-Length": Buffer.byteLength(body) } };
    const req = https.request(opts, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ status: res.statusCode, body: d })); });
    req.on("error", reject); req.write(body); req.end();
  });
}

// Generate a presigned WebSocket URL for the EIC open-tunnel endpoint
function presignEicTunnel(endpointId) {
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const host = `${endpointId}.${REGION}.eic.ec2.aws`;
  const query = {
    Action: "OpenTunnel",
    InstanceId: INSTANCE_ID,
    RemotePort: "22",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${AWS_ACCESS_KEY}/${datestamp}/${REGION}/ec2-instance-connect/aws4_request`,
    "X-Amz-Date": amzdate,
    "X-Amz-Expires": "60",
    "X-Amz-SignedHeaders": "host",
  };
  const qs = Object.keys(query).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&");
  const cr = ["GET", "/", qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const cs = `${datestamp}/${REGION}/ec2-instance-connect/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amzdate}\n${cs}\n${hash(cr)}`;
  const sk = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), "ec2-instance-connect"), "aws4_request");
  const sig = hmac(sk, sts, "hex");
  return `wss://${host}/?${qs}&X-Amz-Signature=${sig}`;
}

const RESIZE_SCRIPT = `
set -e
echo "=== DISK BEFORE ==="
df -h /
lsblk
echo ""
echo "=== RESIZE ==="
ROOT_DEV=$(df / | awk 'NR==2{print $1}' | sed 's/p\\?[0-9]*$//')
PART_NUM=$(df / | awk 'NR==2{print $1}' | grep -oP '[0-9]+$')
echo "Device: $ROOT_DEV  Partition: $PART_NUM"
sudo growpart $ROOT_DEV $PART_NUM || echo "growpart: already at max"
PART_DEV=$(df / | awk 'NR==2{print $1}')
FS=$(df -T / | awk 'NR==2{print $2}')
echo "FS: $FS"
if [ "$FS" = "xfs" ]; then sudo xfs_growfs /; else sudo resize2fs $PART_DEV; fi
echo ""
echo "=== DISK AFTER ==="
df -h /
echo "=== Docker ==="
sudo docker system df 2>/dev/null || true
echo "=== Services ==="
sudo docker ps --format "table {{.Names}}\\t{{.Status}}" 2>/dev/null || true
`.trim();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Check EIC endpoint state
  console.log("🔍 Checking EIC endpoint state...");
  const eicResp = await ec2Request("DescribeInstanceConnectEndpoints");
  const state = (eicResp.body.match(/<state>([^<]+)<\/state>/) || [])[1];
  console.log(`   EIC Endpoint ${EIC_ENDPOINT_ID}: ${state}`);
  if (state !== "create-complete") {
    console.log("   ⏳ Not ready yet. Waiting 30s more...");
    await sleep(30000);
    const eicResp2 = await ec2Request("DescribeInstanceConnectEndpoints");
    const state2 = (eicResp2.body.match(/<state>([^<]+)<\/state>/) || [])[1];
    console.log(`   State now: ${state2}`);
    if (state2 !== "create-complete") {
      console.log("   Still not ready. Try again in a few minutes.");
      return;
    }
  }

  // Get AZ
  const desc = await ec2Request("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  const az = (desc.body.match(/<availabilityZone>([^<]+)<\/availabilityZone>/) || [])[1];

  // Generate temp key
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eic-"));
  const keyPath = path.join(tmpDir, "key");
  console.log("\n🔑 Generating temp key...");
  spawnSync("ssh-keygen", ["-t", "rsa", "-b", "2048", "-f", keyPath, "-N", "", "-q"], { stdio: "inherit" });
  const pubKey = fs.readFileSync(`${keyPath}.pub`, "utf8").trim();

  // Push key
  console.log("📤 Pushing key via EIC...");
  const pushResp = await eicPushKey(az, pubKey);
  console.log(`   HTTP ${pushResp.status}: ${pushResp.body.slice(0, 150)}`);

  // Generate the presigned tunnel URL for use as SSH ProxyCommand
  const wsUrl = presignEicTunnel(EIC_ENDPOINT_ID);
  console.log(`\n🔗 Presigned tunnel URL: ${wsUrl.slice(0, 80)}...`);

  // Try to SSH using ncat/wscat as proxy... but we don't have those.
  // Use the mssh / aws ec2-instance-connect open-tunnel approach
  // Since aws cli is not available, print manual instructions.
  console.log("\n✅ EIC Endpoint is ready.");
  console.log("\n=== TO CONNECT AND RUN THE FILESYSTEM RESIZE ===");
  console.log("\n📋 Option A — AWS Console (Recommended):");
  console.log("  1. Visit: https://us-east-1.console.aws.amazon.com/ec2/home#Instances:");
  console.log("  2. Select instance: i-09ec7300ad9e03274");
  console.log("  3. Click 'Connect' at top → 'EC2 Instance Connect' tab");
  console.log("     OR 'Session Manager' tab (if SSM agent is running)");
  console.log("  4. Click 'Connect'");
  console.log("  5. Paste and run these commands:\n");
  RESIZE_SCRIPT.split("\n").forEach(l => console.log("     " + l));

  console.log("\n📋 Option B — If you install AWS CLI:");
  console.log("  aws ec2-instance-connect open-tunnel \\");
  console.log(`    --instance-id ${INSTANCE_ID} \\`);
  console.log(`    --remote-port 22 \\`);
  console.log(`    --instance-connect-endpoint-id ${EIC_ENDPOINT_ID} \\`);
  console.log("    --region us-east-1");

  fs.rmSync(tmpDir, { recursive: true });
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
