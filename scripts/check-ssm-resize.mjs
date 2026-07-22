/**
 * Try SSM StartSession (port-forwarding) or run-command via the EC2 Metadata IMDSv2
 * to check what SSM permissions are available, and attempt the resize via
 * different SSM document names.
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

async function ec2Request(action, params = {}) {
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const host = `ec2.${REGION}.amazonaws.com`;
  const query = { Action: action, Version: "2016-11-15", ...params };
  const canonicalQuerystring = Object.keys(query).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&");
  const payloadHash = hash("");
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = "host;x-amz-date";
  const canonicalRequest = ["GET", "/", canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${datestamp}/${REGION}/ec2/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzdate}\n${credentialScope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), "ec2"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: `/?${canonicalQuerystring}`,
      method: "GET",
      headers: { "x-amz-date": amzdate, Authorization: authHeader },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1. Check volume modification state
  console.log("📊 Checking volume modification state...");
  const volMod = await ec2Request("DescribeVolumesModifications", { "VolumeId.1": "vol-00647988bdc277971" });
  const modState = (volMod.body.match(/<modificationState>([^<]+)<\/modificationState>/) || [])[1];
  const targetSize = (volMod.body.match(/<targetSize>(\d+)<\/targetSize>/) || [])[1];
  const origSize = (volMod.body.match(/<originalSize>(\d+)<\/originalSize>/) || [])[1];
  console.log(`   Volume: ${origSize}GB → ${targetSize}GB | State: ${modState}`);

  // 2. Try SSM DescribeInstanceInformation to see if instance is SSM-managed
  console.log("\n🔍 Checking SSM agent status...");
  const ssmInfo = await ssmRequest("DescribeInstanceInformation", {
    Filters: [{ Key: "InstanceIds", Values: [INSTANCE_ID] }],
  });
  console.log(`   HTTP ${ssmInfo.status}:`, ssmInfo.body.slice(0, 300));

  if (ssmInfo.status === 200) {
    const parsed = JSON.parse(ssmInfo.body);
    const info = parsed.InstanceInformationList?.[0];
    if (info) {
      console.log(`   SSM Agent: ${info.AgentVersion} | Ping: ${info.PingStatus} | Platform: ${info.PlatformName}`);
    } else {
      console.log("   Instance not found in SSM — SSM agent may not be running or IAM role missing.");
    }
  }

  // 3. Try to run command with AWS-RunShellScript
  console.log("\n🖥️  Trying SSM RunCommand with AWS-RunShellScript...");
  const cmdResp = await ssmRequest("SendCommand", {
    InstanceIds: [INSTANCE_ID],
    DocumentName: "AWS-RunShellScript",
    Parameters: {
      commands: [
        "df -h /",
        "lsblk",
        "ROOT_DEV=$(df / | awk 'NR==2{print $1}' | sed 's/p\\?[0-9]*$//')",
        "PART_NUM=$(df / | awk 'NR==2{print $1}' | grep -oP '[0-9]+$')",
        "echo Root=$ROOT_DEV Part=$PART_NUM",
        "sudo growpart $ROOT_DEV $PART_NUM 2>&1 || true",
        "sudo resize2fs $(df / | awk 'NR==2{print $1}') 2>&1 || sudo xfs_growfs / 2>&1 || true",
        "df -h /",
      ],
    },
    TimeoutSeconds: 60,
  });
  console.log(`   SendCommand HTTP ${cmdResp.status}:`, cmdResp.body.slice(0, 400));

  if (cmdResp.status === 200) {
    const cmdId = JSON.parse(cmdResp.body)?.Command?.CommandId;
    console.log(`   CommandId: ${cmdId}`);
    console.log("   Waiting 30s for result...");
    await sleep(30000);

    for (let i = 0; i < 8; i++) {
      const res = await ssmRequest("GetCommandInvocation", { CommandId: cmdId, InstanceId: INSTANCE_ID });
      if (res.status !== 200) { await sleep(5000); continue; }
      const r = JSON.parse(res.body);
      console.log(`   Status: ${r.StatusDetails}`);
      if (["Success", "Failed", "TimedOut"].includes(r.StatusDetails)) {
        console.log("\n=== OUTPUT ===\n" + r.StandardOutputContent);
        if (r.StandardErrorContent?.trim()) console.log("=== STDERR ===\n" + r.StandardErrorContent);
        break;
      }
      await sleep(5000);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
