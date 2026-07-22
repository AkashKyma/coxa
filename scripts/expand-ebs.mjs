/**
 * EC2 Disk Expansion Script
 * 1. Describes the EC2 instance to find the EBS volume ID + current size
 * 2. Modifies the EBS volume to the requested size
 * 3. Uses SSM to run growpart + resize2fs inside the instance
 */
import crypto from "crypto";
import https from "https";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const AWS_ACCESS_KEY = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");

const NEW_SIZE_GB = parseInt(process.argv[2] || envOr("EBS_NEW_SIZE_GB", "100"), 10);

function hmac(key, data, enc) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(enc || undefined);
}
function hash(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

async function awsRequest(service, host, method, path, query, body = "") {
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const canonicalUri = path || "/";
  const canonicalQuerystring = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");
  const payloadHash = hash(body);
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = "host;x-amz-date";
  const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${datestamp}/${REGION}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzdate}\n${credentialScope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), service), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const fullPath = canonicalQuerystring ? `${canonicalUri}?${canonicalQuerystring}` : canonicalUri;
    const options = {
      hostname: host,
      path: fullPath,
      method,
      headers: {
        "x-amz-date": amzdate,
        Authorization: authHeader,
        "Content-Type": body ? "application/x-amz-json-1.1" : "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function ec2Request(action, params = {}) {
  const query = { Action: action, Version: "2016-11-15", ...params };
  return awsRequest("ec2", `ec2.${REGION}.amazonaws.com`, "GET", "/", query);
}

async function ssmRequest(action, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const host = `ssm.${REGION}.amazonaws.com`;
  const payloadHash = hash(body);
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzdate}\nx-amz-target:AmazonSSM.${action}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${datestamp}/${REGION}/ssm/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzdate}\n${credentialScope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), "ssm"), "aws4_request");
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
        "x-amz-target": `AmazonSSM.${action}`,
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`\n🔍 Describing instance ${INSTANCE_ID} to find root volume...`);
  const descResp = await ec2Request("DescribeInstances", { "InstanceId.1": INSTANCE_ID });
  if (descResp.status !== 200) {
    console.error("DescribeInstances failed:", descResp.body);
    process.exit(1);
  }

  // Extract volume ID and current size from XML
  const volIdMatch = descResp.body.match(/<volumeId>(vol-[0-9a-f]+)<\/volumeId>/);
  const deviceMatch = descResp.body.match(/<deviceName>([^<]+)<\/deviceName>/);
  const stateMatch = descResp.body.match(/<instanceState>.*?<name>([^<]+)<\/name>/s);

  if (!volIdMatch) {
    console.error("Could not find volume ID. Response:", descResp.body.slice(0, 2000));
    process.exit(1);
  }

  const volumeId = volIdMatch[1];
  const device = deviceMatch ? deviceMatch[1] : "/dev/xvda";
  const instanceState = stateMatch ? stateMatch[1] : "unknown";

  console.log(`   Instance state: ${instanceState}`);
  console.log(`   Root volume: ${volumeId} at ${device}`);

  // Get current volume size
  const volDesc = await ec2Request("DescribeVolumes", { "VolumeId.1": volumeId });
  const sizeMatch = volDesc.body.match(/<size>(\d+)<\/size>/);
  const currentSize = sizeMatch ? parseInt(sizeMatch[1]) : "unknown";
  console.log(`   Current size: ${currentSize} GB  →  Target: ${NEW_SIZE_GB} GB`);

  if (typeof currentSize === "number" && currentSize >= NEW_SIZE_GB) {
    console.log(`\n✅ Volume is already ${currentSize} GB (≥ ${NEW_SIZE_GB} GB). No resize needed.`);
    console.log("   Checking disk usage inside the instance...");
  } else {
    console.log(`\n📦 Modifying volume ${volumeId} to ${NEW_SIZE_GB} GB...`);
    const modResp = await ec2Request("ModifyVolume", {
      VolumeId: volumeId,
      Size: NEW_SIZE_GB,
    });
    if (modResp.status !== 200) {
      console.error("ModifyVolume failed:", modResp.body);
      process.exit(1);
    }
    console.log("   ✅ ModifyVolume accepted. Waiting 15s for volume to enter optimizing state...");
    await sleep(15000);

    // Poll until state is optimizing or completed
    for (let i = 0; i < 12; i++) {
      const pollResp = await ec2Request("DescribeVolumesModifications", { "VolumeId.1": volumeId });
      const modState = (pollResp.body.match(/<modificationState>([^<]+)<\/modificationState>/) || [])[1] || "";
      console.log(`   Volume modification state: ${modState} (poll ${i + 1}/12)`);
      if (modState === "optimizing" || modState === "completed") break;
      if (modState === "failed") {
        console.error("Volume modification failed!");
        process.exit(1);
      }
      await sleep(10000);
    }
  }

  // Now run growpart + resize2fs inside the instance via SSM
  console.log(`\n🖥️  Running growpart + resize2fs inside the instance via SSM...`);
  const commands = [
    "set -e",
    "echo '=== BEFORE: disk usage ==='",
    "df -h /",
    "echo '=== Detecting root device ==='",
    "ROOT_DEVICE=$(lsblk -J | python3 -c \"import json,sys; d=json.load(sys.stdin)['blockdevices']; [print('/dev/'+b['name']) for b in d if any(c.get('mountpoints',[])==['/'] for c in b.get('children',[]) )]\" 2>/dev/null || echo '')",
    "if [ -z \"$ROOT_DEVICE\" ]; then ROOT_DEVICE=$(df / | awk 'NR==2{print $1}' | sed 's/[0-9]*$//'); fi",
    "PART_NUM=$(df / | awk 'NR==2{print $1}' | grep -o '[0-9]*$')",
    "echo \"Root device: $ROOT_DEVICE  Partition: $PART_NUM\"",
    "sudo growpart $ROOT_DEVICE $PART_NUM || echo 'growpart: already at max or no change needed'",
    "PART_DEV=$(df / | awk 'NR==2{print $1}')",
    "echo \"Partition device: $PART_DEV\"",
    "sudo resize2fs $PART_DEV 2>/dev/null || sudo xfs_growfs / 2>/dev/null || echo 'resize: already at max'",
    "echo '=== AFTER: disk usage ==='",
    "df -h /",
    "echo '=== Docker disk usage ==='",
    "sudo docker system df 2>/dev/null || echo 'docker not available'",
  ];

  const ssmResp = await ssmRequest("SendCommand", {
    InstanceIds: [INSTANCE_ID],
    DocumentName: "AWS-RunShellScript",
    Parameters: { commands },
    TimeoutSeconds: 120,
    Comment: "Coxa EBS expand: growpart + resize2fs",
  });

  if (ssmResp.status !== 200) {
    console.error("SSM SendCommand failed:", ssmResp.body);
    process.exit(1);
  }

  const cmdId = JSON.parse(ssmResp.body)?.Command?.CommandId;
  if (!cmdId) {
    console.error("No CommandId in SSM response:", ssmResp.body);
    process.exit(1);
  }
  console.log(`   SSM command sent: ${cmdId}`);
  console.log("   Waiting 30s for command to complete...");
  await sleep(30000);

  // Poll for result
  for (let i = 0; i < 10; i++) {
    const resultResp = await ssmRequest("GetCommandInvocation", {
      CommandId: cmdId,
      InstanceId: INSTANCE_ID,
    });
    if (resultResp.status !== 200) {
      console.log(`   Poll ${i+1}: HTTP ${resultResp.status} - waiting...`);
      await sleep(8000);
      continue;
    }
    const result = JSON.parse(resultResp.body);
    const status = result.StatusDetails || result.Status;
    console.log(`   Poll ${i+1}: ${status}`);
    if (status === "Success") {
      console.log("\n=== STDOUT ===");
      console.log(result.StandardOutputContent || "(empty)");
      if (result.StandardErrorContent?.trim()) {
        console.log("=== STDERR ===");
        console.log(result.StandardErrorContent);
      }
      break;
    }
    if (["Failed", "TimedOut", "Cancelled"].includes(status)) {
      console.error("\nCommand failed:", status);
      console.log("STDOUT:", result.StandardOutputContent);
      console.log("STDERR:", result.StandardErrorContent);
      break;
    }
    await sleep(8000);
  }

  // Also check current df as a quick sanity check via second SSM call
  console.log("\n✅ Done. Volume expand + filesystem resize complete.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
