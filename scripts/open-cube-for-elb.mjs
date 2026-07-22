/**
 * Opens port 4000 (Cube API) on the EC2 Security Group,
 * restricted to the ELB's CIDR or open to 0.0.0.0/0 if no ELB CIDR is provided.
 * Also updates CUBE_API_URL in backend/.env.elb.example to use the EC2 public IP.
 */
import crypto from "crypto";
import https from "https";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const COXA_DIR = join(__dirname, "..");

const AWS_ACCESS_KEY = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");
const EC2_IP = envOr("EC2_IP_CUBE", requireEnv("EC2_PUBLIC_IP"));

// Set to your ELB's specific CIDR for tighter security, e.g. "52.x.x.x/32"
// Leave as "0.0.0.0/0" to allow from anywhere (less secure but simpler)
const ALLOWED_CIDR = envOr("CUBE_ALLOWED_CIDR", "0.0.0.0/0");

function hmac(key, data, enc) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(enc || undefined);
}
function hash(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

async function ec2Request(action, params = {}) {
  const host = `ec2.${REGION}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const allParams = { Action: action, Version: "2016-11-15", ...params };
  const body = Object.keys(allParams).sort().map(k =>
    encodeURIComponent(k) + "=" + encodeURIComponent(allParams[k])
  ).join("&");
  const payloadHash = hash(body);
  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credScope = `${dateStamp}/${REGION}/ec2/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac("AWS4" + AWS_SECRET_KEY, dateStamp), REGION), "ec2"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, path: "/", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Amz-Date": amzDate, "Authorization": authHeader, "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function get(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return m ? m[1] : null;
}
function getAll(xml, tag) {
  const results = [];
  const re = new RegExp(`<${tag}>(.*?)</${tag}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

// ── Step 1: Get Security Group ID ─────────────────────────────────────────────
console.log("Fetching Security Group for instance...");
const instRes = await ec2Request("DescribeInstances", {
  "Filter.1.Name": "instance-id",
  "Filter.1.Value.1": INSTANCE_ID,
});
const sgIds = getAll(instRes.body, "groupId");
if (!sgIds.length) { console.error("No security groups found."); process.exit(1); }
const sgId = sgIds[0];
console.log(`  SG: ${sgId}`);

// ── Step 2: Check existing rules ──────────────────────────────────────────────
const sgRes = await ec2Request("DescribeSecurityGroups", { "GroupId.1": sgId });
const existingPorts = getAll(sgRes.body, "fromPort").map(Number);
console.log(`  Existing open ports: ${existingPorts.join(", ")}`);

// ── Step 3: Open port 4000 (Cube) ─────────────────────────────────────────────
const PORT = 4000;
if (existingPorts.includes(PORT)) {
  console.log(`\n  Port ${PORT} already open — skipping.`);
} else {
  console.log(`\nOpening port ${PORT} (Cube API) from CIDR ${ALLOWED_CIDR}...`);
  const res = await ec2Request("AuthorizeSecurityGroupIngress", {
    GroupId: sgId,
    "IpPermissions.1.IpProtocol": "tcp",
    "IpPermissions.1.FromPort": String(PORT),
    "IpPermissions.1.ToPort": String(PORT),
    "IpPermissions.1.IpRanges.1.CidrIp": ALLOWED_CIDR,
    "IpPermissions.1.IpRanges.1.Description": "Coxa Cube API - ELB backend access",
  });
  if (res.status === 200 || res.body.includes("return>true")) {
    console.log(`  ✓ Port ${PORT} opened`);
  } else if (res.body.includes("InvalidPermission.Duplicate")) {
    console.log(`  Port ${PORT} rule already exists`);
  } else {
    console.log(`  ✗ Failed: ${res.body.match(/<Message>(.*?)<\/Message>/)?.[1] ?? res.body.slice(0, 200)}`);
  }
}

// ── Step 4: Update backend env files ──────────────────────────────────────────
console.log("\nUpdating CUBE_API_URL in env files...");
const envFiles = [
  join(COXA_DIR, "backend/.env.elb.example"),
  join(COXA_DIR, "infrastructure/.env.cdp.example"),
];
const correctUrl = `http://${EC2_IP}:${PORT}/cubejs-api/v1`;
for (const f of envFiles) {
  try {
    let c = readFileSync(f, "utf8");
    // Replace localhost:4000 or old IP:4000 with correct EC2 IP
    const updated = c.replace(
      /CUBE_API_URL=http:\/\/[^/\n]+\/cubejs-api\/v1/g,
      `CUBE_API_URL=${correctUrl}`
    );
    if (updated !== c) {
      writeFileSync(f, updated);
      console.log(`  ✓ Updated ${f.replace(COXA_DIR + "\\", "").replace(COXA_DIR + "/", "")}`);
    } else {
      console.log(`  = ${f.replace(COXA_DIR + "\\", "")} — no change needed`);
    }
  } catch { console.log(`  ! ${f} not found`); }
}

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Port 4000 (Cube API) opened on Security Group ${sgId}
║  
║  Add to backend/.env on ELB:
║    CUBE_API_URL=${correctUrl}
║    CUBE_API_SECRET=coxa-cube-dev-secret-change-in-prod
║  
║  ⚠  Security tip: restrict CIDR to your ELB's IP only.
║     Edit ALLOWED_CIDR in this script for tighter control.
╚══════════════════════════════════════════════════════════════╝
`);
