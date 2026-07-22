/**
 * Correctly find the AZ of the instance and push SSH key via EC2 Instance Connect.
 */
import crypto from "crypto";
import https from "https";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const AWS_ACCESS_KEY = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");
const PUBLIC_IP = requireEnv("EC2_PUBLIC_IP");
const SSH_USER = envOr("EC2_SSH_USER", "ubuntu");

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

async function eicPushKey(az, publicKey) {
  const body = JSON.stringify({ InstanceId: INSTANCE_ID, InstanceOSUser: SSH_USER, SSHPublicKey: publicKey, AvailabilityZone: az });
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
    const opts = {
      hostname: host, path: "/v1/push-public-key", method: "POST",
      headers: { "Content-Type": "application/json", "x-amz-date": amzdate, Authorization: auth, "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(opts, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

const RESIZE_SCRIPT = `
set -e
echo "=== DISK BEFORE ==="
df -h /
echo ""
lsblk
echo ""
echo "=== RESIZE ==="
ROOT_DEV=$(df / | awk 'NR==2{print $1}' | sed 's/p\\?[0-9]*$//')
PART_NUM=$(df / | awk 'NR==2{print $1}' | grep -oP '[0-9]+$')
echo "Root device: $ROOT_DEV  Partition: $PART_NUM"
sudo growpart $ROOT_DEV $PART_NUM || echo "growpart: nothing to do"
PART_DEV=$(df / | awk 'NR==2{print $1}')
FS=$(df -T / | awk 'NR==2{print $2}')
echo "Filesystem: $FS on $PART_DEV"
if [ "$FS" = "xfs" ]; then sudo xfs_growfs /; else sudo resize2fs $PART_DEV; fi
echo ""
echo "=== DISK AFTER ==="
df -h /
echo ""
echo "=== Docker ==="
sudo docker system df 2>/dev/null || true
echo "=== Services ==="
sudo docker ps --format "table {{.Names}}\\t{{.Status}}" 2>/dev/null | head -20 || true
`.trim();

async function main() {
  // 1. Get instance AZ
  console.log("🔍 Getting instance availability zone...");
  const descResp = await ec2Request("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  const az = (descResp.body.match(/<availabilityZone>([^<]+)<\/availabilityZone>/) || [])[1];
  console.log(`   AZ: ${az}`);

  // 2. Generate temp SSH key
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eic-"));
  const keyPath = path.join(tmpDir, "id_rsa");
  console.log("\n🔑 Generating temporary RSA key...");
  spawnSync("ssh-keygen", ["-t", "rsa", "-b", "2048", "-f", keyPath, "-N", "", "-C", "eic-temp"], { stdio: "inherit" });
  const pubKey = fs.readFileSync(`${keyPath}.pub`, "utf8").trim();

  // 3. Push key
  console.log(`\n📤 Pushing key via EC2 Instance Connect (AZ: ${az})...`);
  const pushResp = await eicPushKey(az, pubKey);
  console.log(`   HTTP ${pushResp.status}: ${pushResp.body.slice(0, 200)}`);

  if (pushResp.status !== 200) {
    console.error("\n❌ Instance Connect key push failed. Possible reasons:");
    console.error("   - EC2 Instance Connect is not enabled/installed on the instance");
    console.error("   - Port 22 is not open in the Security Group");
    console.error("   - IAM user lacks ec2-instance-connect:SendSSHPublicKey permission");
    console.log("\n💡 MANUAL STEPS REQUIRED:");
    console.log("   1. Log in to AWS Console → EC2 → Instances → i-09ec7300ad9e03274");
    console.log("   2. Click 'Connect' → 'EC2 Instance Connect' → 'Connect'");
    console.log("   3. Run these commands in the browser terminal:");
    console.log("   ---");
    console.log(RESIZE_SCRIPT);
    console.log("   ---");
    fs.rmSync(tmpDir, { recursive: true });
    return;
  }

  // 4. SSH in and run resize
  console.log("\n🖥️  SSHing in and running growpart + resize2fs...");
  const result = spawnSync("ssh", [
    "-i", keyPath,
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=20",
    `${SSH_USER}@${PUBLIC_IP}`,
    "bash -s",
  ], { input: RESIZE_SCRIPT, encoding: "utf8", timeout: 90000 });

  if (result.stdout) console.log(result.stdout);
  if (result.stderr && !result.stderr.includes("Warning: Permanently")) console.log("STDERR:", result.stderr);
  if (result.status !== 0) {
    console.error(`\n❌ SSH exit ${result.status}`);
    if (result.error) console.error(result.error.message);
  } else {
    console.log("\n✅ Filesystem resize complete.");
  }

  fs.rmSync(tmpDir, { recursive: true });
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
