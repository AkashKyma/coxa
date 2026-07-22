/**
 * SSH into EC2 via EC2 Instance Connect (no PEM needed)
 * then run growpart + resize2fs to expand the filesystem
 * after the EBS volume was already enlarged.
 */
import crypto from "crypto";
import https from "https";
import { execSync, spawnSync } from "child_process";
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
const AZ = envOr("EC2_AZ", "us-east-1b");

function hmac(key, data, enc) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(enc || undefined);
}
function hash(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

async function awsPost(service, host, target, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const payloadHash = hash(body);
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzdate}\nx-amz-target:${target}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${datestamp}/${REGION}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzdate}\n${credentialScope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), service), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: "/",
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "x-amz-date": amzdate,
        "x-amz-target": target,
        Authorization: authHeader,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function ec2ConnectSendKey(publicKey) {
  const host = `ec2-instance-connect.${REGION}.amazonaws.com`;
  const body = JSON.stringify({
    InstanceId: INSTANCE_ID,
    InstanceOSUser: SSH_USER,
    SSHPublicKey: publicKey,
    AvailabilityZone: AZ,
  });
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const payloadHash = hash(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = ["POST", "/v1/push-public-key", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${datestamp}/${REGION}/ec2-instance-connect/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzdate}\n${credentialScope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), "ec2-instance-connect"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: "/v1/push-public-key",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-amz-date": amzdate,
        Authorization: authHeader,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Generate a temporary SSH key pair
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ec2conn-"));
  const keyPath = path.join(tmpDir, "id_ed25519");
  console.log("🔑 Generating temporary SSH key pair...");
  spawnSync("ssh-keygen", ["-t", "ed25519", "-f", keyPath, "-N", "", "-C", "ec2-instance-connect-tmp"], {
    stdio: "inherit",
  });
  const publicKey = fs.readFileSync(`${keyPath}.pub`, "utf8").trim();
  console.log("   Public key:", publicKey.slice(0, 60) + "...");

  // Push public key to the instance (valid for 60 seconds)
  console.log("\n📤 Pushing public key via EC2 Instance Connect...");
  const pushResp = await ec2ConnectSendKey(publicKey);
  console.log(`   HTTP ${pushResp.status}: ${pushResp.body}`);
  if (pushResp.status !== 200) {
    console.error("Failed to push key. Check IAM permissions for ec2-instance-connect:SendSSHPublicKey");
    process.exit(1);
  }

  // Run the resize commands over SSH
  const remoteScript = `
set -e
echo "=== BEFORE: disk usage ==="
df -h /
echo ""
echo "=== Block devices ==="
lsblk
echo ""
echo "=== Running growpart ==="
ROOT_DEV=$(lsblk -J 2>/dev/null | python3 -c "import json,sys; bl=json.load(sys.stdin)['blockdevices']; [print('/dev/'+b['name']) for b in bl if any(c.get('mountpoints',[])==['/'] for c in b.get('children',[]))]" 2>/dev/null)
if [ -z "$ROOT_DEV" ]; then
  ROOT_DEV=$(df / | awk 'NR==2{print $1}' | sed 's/p\\?[0-9]*$//')
fi
PART_NUM=$(df / | awk 'NR==2{print $1}' | grep -oP '[0-9]+$')
echo "Root device: $ROOT_DEV  Part: $PART_NUM"
sudo growpart $ROOT_DEV $PART_NUM || echo "(growpart: already at max or nothing to do)"
PART_DEV=$(df / | awk 'NR==2{print $1}')
echo "Partition: $PART_DEV"
FS_TYPE=$(df -T / | awk 'NR==2{print $2}')
echo "Filesystem type: $FS_TYPE"
if [ "$FS_TYPE" = "xfs" ]; then
  sudo xfs_growfs /
else
  sudo resize2fs $PART_DEV
fi
echo ""
echo "=== AFTER: disk usage ==="
df -h /
echo ""
echo "=== Docker disk usage ==="
sudo docker system df 2>/dev/null || true
`.trim();

  const scriptFile = path.join(tmpDir, "resize.sh");
  fs.writeFileSync(scriptFile, remoteScript.replace(/\r\n/g, "\n"));

  console.log("\n🖥️  Connecting via SSH and running resize commands...");
  const sshResult = spawnSync(
    "ssh",
    [
      "-i", keyPath,
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=20",
      `${SSH_USER}@${PUBLIC_IP}`,
      "bash -s",
    ],
    {
      input: remoteScript,
      encoding: "utf8",
      timeout: 90000,
    }
  );

  if (sshResult.stdout) console.log(sshResult.stdout);
  if (sshResult.stderr && !sshResult.stderr.includes("Warning:")) console.log("STDERR:", sshResult.stderr);
  if (sshResult.status !== 0) {
    console.error("\n❌ SSH command failed. Exit:", sshResult.status);
    if (sshResult.error) console.error(sshResult.error.message);
  } else {
    console.log("\n✅ Filesystem expanded successfully.");
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
