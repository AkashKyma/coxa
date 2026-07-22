/**
 * Opens required Security Group ports on the Coxa EC2 instance.
 * Also fetches the Security Group ID automatically from the instance.
 */
import crypto from "crypto";
import https from "https";

import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const AWS_ACCESS_KEY = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");

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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Amz-Date": amzDate,
        "Authorization": authHeader,
        "Content-Length": Buffer.byteLength(body),
      },
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

function getAll(xml, tag) {
  const results = [];
  const re = new RegExp(`<${tag}>(.*?)</${tag}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

function get(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return m ? m[1] : null;
}

// ─── Step 1: Get Security Group IDs for the instance ──────────────────────
console.log("Step 1: Fetching Security Groups for instance...");
const instRes = await ec2Request("DescribeInstances", {
  "Filter.1.Name": "instance-id",
  "Filter.1.Value.1": INSTANCE_ID,
});

const sgIds = getAll(instRes.body, "groupId");
console.log(`  Found Security Groups: ${sgIds.join(", ")}`);

if (!sgIds.length) {
  console.error("No security groups found. Check instance ID.");
  process.exit(1);
}

// Use the first SG (primary)
const sgId = sgIds[0];
console.log(`  Using SG: ${sgId}\n`);

// ─── Step 2: Describe current ingress rules ────────────────────────────────
console.log("Step 2: Checking existing ingress rules...");
const sgRes = await ec2Request("DescribeSecurityGroups", {
  "GroupId.1": sgId,
});

const existingPorts = getAll(sgRes.body, "fromPort").map(Number);
console.log(`  Existing open ports: ${existingPorts.join(", ") || "none"}\n`);

// ─── Step 3: Open required ports ──────────────────────────────────────────
const PORTS_TO_OPEN = [
  { port: 8080, desc: "RudderStack data-plane" },
  { port: 9090, desc: "RudderStack transformer" },
  { port: 8000, desc: "PostHog" },
  { port: 5000, desc: "Coxa backend API" },
  { port: 3000, desc: "Coxa backend (alt)" },
];

console.log("Step 3: Opening required ports...");
for (const { port, desc } of PORTS_TO_OPEN) {
  if (existingPorts.includes(port)) {
    console.log(`  ${port} (${desc}) — already open, skipping`);
    continue;
  }

  const params = {
    GroupId: sgId,
    "IpPermissions.1.IpProtocol": "tcp",
    "IpPermissions.1.FromPort": String(port),
    "IpPermissions.1.ToPort": String(port),
    "IpPermissions.1.IpRanges.1.CidrIp": "0.0.0.0/0",
    "IpPermissions.1.IpRanges.1.Description": `Coxa CDP - ${desc}`,
  };

  const res = await ec2Request("AuthorizeSecurityGroupIngress", params);
  if (res.status === 200 || res.body.includes("return>true")) {
    console.log(`  ✓ Opened ${port} (${desc})`);
  } else if (res.body.includes("InvalidPermission.Duplicate")) {
    console.log(`  ${port} (${desc}) — already existed`);
  } else {
    console.log(`  ✗ Failed to open ${port}: ${res.body.match(/<Message>(.*?)<\/Message>/)?.[1] ?? "unknown"}`);
  }
}

console.log("\nDone. Wait ~30 seconds then re-run probe-ec2.mjs to verify.");
