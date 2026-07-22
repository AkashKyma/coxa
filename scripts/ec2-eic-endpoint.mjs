/**
 * Attempt to connect to EC2 via EIC Endpoint (newer approach that doesn't require
 * port 22 to be open or the instance-connect agent to be installed).
 * Also try to create an EIC Endpoint if one doesn't exist.
 */
import crypto from "crypto";
import https from "https";
import { spawnSync, execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const AWS_ACCESS_KEY = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");
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
echo "FS type: $FS"
if [ "$FS" = "xfs" ]; then sudo xfs_growfs /; else sudo resize2fs $PART_DEV; fi
echo ""
echo "=== DISK AFTER ==="
df -h /
echo ""
echo "=== Docker ==="
sudo docker system df 2>/dev/null || true
echo "=== Running Services ==="
sudo docker ps --format "table {{.Names}}\\t{{.Status}}" 2>/dev/null || true
`.trim();

async function main() {
  // Check if EIC endpoint exists for the VPC
  console.log("🔍 Checking for EC2 Instance Connect Endpoints...");
  const eicResp = await ec2Request("DescribeInstanceConnectEndpoints");
  console.log(`   HTTP ${eicResp.status}`);
  if (eicResp.status === 200) {
    const endpoints = [...eicResp.body.matchAll(/<instanceConnectEndpointId>([^<]+)<\/instanceConnectEndpointId>/g)].map(m => m[1]);
    const states = [...eicResp.body.matchAll(/<state>([^<]+)<\/state>/g)].map(m => m[1]);
    if (endpoints.length > 0) {
      console.log("   Found EIC Endpoints:", endpoints.map((id, i) => `${id} (${states[i]})`).join(", "));
    } else {
      console.log("   No EIC Endpoints found.");
    }
  } else {
    console.log("   Response:", eicResp.body.slice(0, 300));
  }

  // Get instance details
  const desc = await ec2Request("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  const subnetId = (desc.body.match(/<subnetId>(subnet-[0-9a-f]+)<\/subnetId>/) || [])[1];
  const vpcId = (desc.body.match(/<vpcId>(vpc-[0-9a-f]+)<\/vpcId>/) || [])[1];
  const az = (desc.body.match(/<availabilityZone>([^<]+)<\/availabilityZone>/) || [])[1];
  console.log(`   Instance: AZ=${az}, VPC=${vpcId}, Subnet=${subnetId}`);

  // If no EIC endpoint, try to create one
  const hasEndpoint = eicResp.body.includes("<state>create-complete</state>");
  if (!hasEndpoint) {
    console.log("\n📝 Creating EC2 Instance Connect Endpoint in the instance's subnet...");
    const createResp = await ec2Request("CreateInstanceConnectEndpoint", {
      SubnetId: subnetId,
    });
    console.log(`   HTTP ${createResp.status}:`, createResp.body.slice(0, 500));
    if (createResp.status !== 200) {
      console.log("\n⚠️  Cannot create EIC Endpoint — falling back to manual instructions.");
    } else {
      console.log("   ✅ EIC Endpoint creation initiated. It takes ~2 minutes to become active.");
      console.log("   Re-run this script after a few minutes to SSH through the endpoint.");
      return;
    }
  }

  // Try direct SSH with the EIC endpoint proxy command (requires aws-cli)
  console.log("\n💡 The EBS volume is already being expanded (70GB → 100GB, state: optimizing).");
  console.log("\n=== MANUAL STEPS TO RESIZE THE FILESYSTEM ===");
  console.log("\nOption A — AWS Console (easiest):");
  console.log("  1. Go to: https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:");
  console.log("  2. Select instance i-09ec7300ad9e03274");
  console.log("  3. Click 'Connect' → 'Session Manager' tab → 'Connect'");
  console.log("  4. If Session Manager is unavailable, use 'EC2 Instance Connect' tab");
  console.log("  5. Run these commands:");
  console.log("\n--- commands ---");
  console.log(RESIZE_SCRIPT.split("\n").map(l => "  " + l).join("\n"));
  console.log("--- end ---");
  console.log("\nOption B — If you have the Coxa_Services.pem key file:");
  console.log(`  ssh -i Coxa_Services.pem ubuntu@3.217.225.85`);
  console.log("  Then run the commands above.");
  console.log("\nNote: Volume will show 100GB in 'df' ONLY after growpart+resize2fs are run.");
  console.log("The EBS enlargement at the AWS level is already done.");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
