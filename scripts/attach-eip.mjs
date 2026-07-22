import crypto from "crypto";
import https from "https";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const KEY = requireEnv("AWS_ACCESS_KEY_ID");
const SECRET = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const INSTANCE_ID = requireEnv("EC2_INSTANCE_ID");
const ZONE_ID = requireEnv("ROUTE53_ZONE_ID");
const DOMAIN = envOr("POSTHOG_DOMAIN", "posthog.service.coxa.live");

function sign(k, m) { return crypto.createHmac("sha256", k).update(m).digest(); }
function sigKey(s, d, r, sv) { return sign(sign(sign(sign("AWS4" + s, d), r), sv), "aws4_request"); }

function ec2req(action, extra = {}) {
  return new Promise((res, rej) => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const params = new URLSearchParams({ Action: action, Version: "2016-11-15", ...extra });
    const body = params.toString();
    const host = "ec2." + REGION + ".amazonaws.com";
    const hash = crypto.createHash("sha256").update(body).digest("hex");
    const hdrs = { "content-type": "application/x-www-form-urlencoded", host, "x-amz-date": time, "x-amz-content-sha256": hash };
    const hs = Object.keys(hdrs).sort().map(k => k + ":" + hdrs[k]).join("\n");
    const sk = Object.keys(hdrs).sort().join(";");
    const cr = "POST\n/\n\n" + hs + "\n\n" + sk + "\n" + hash;
    const ss = "AWS4-HMAC-SHA256\n" + time + "\n" + date + "/" + REGION + "/ec2/aws4_request\n" + crypto.createHash("sha256").update(cr).digest("hex");
    const sig = sign(sigKey(SECRET, date, REGION, "ec2"), ss).toString("hex");
    const auth = "AWS4-HMAC-SHA256 Credential=" + KEY + "/" + date + "/" + REGION + "/ec2/aws4_request, SignedHeaders=" + sk + ", Signature=" + sig;
    const req = https.request({ host, method: "POST", path: "/", headers: { ...hdrs, authorization: auth } }, (r) => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => res(d));
    });
    req.on("error", rej); req.write(body); req.end();
  });
}

function r53req(body) {
  return new Promise((res, rej) => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const host = "route53.amazonaws.com";
    const path = `/2013-04-01/hostedzone/${ZONE_ID}/rrset/`;
    const hash = crypto.createHash("sha256").update(body).digest("hex");
    const hdrs = { "content-type": "application/xml", host, "x-amz-date": time, "x-amz-content-sha256": hash };
    const hs = Object.keys(hdrs).sort().map(k => k + ":" + hdrs[k]).join("\n");
    const sk = Object.keys(hdrs).sort().join(";");
    const cr = "POST\n" + path + "\n\n" + hs + "\n\n" + sk + "\n" + hash;
    const ss = "AWS4-HMAC-SHA256\n" + time + "\n" + date + "/" + REGION + "/route53/aws4_request\n" + crypto.createHash("sha256").update(cr).digest("hex");
    const sig = sign(sigKey(SECRET, date, REGION, "route53"), ss).toString("hex");
    const auth = "AWS4-HMAC-SHA256 Credential=" + KEY + "/" + date + "/" + REGION + "/route53/aws4_request, SignedHeaders=" + sk + ", Signature=" + sig;
    const req = https.request({ host, method: "POST", path, headers: { ...hdrs, authorization: auth } }, (r) => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => res({ status: r.statusCode, body: d }));
    });
    req.on("error", rej); req.write(body); req.end();
  });
}

function get(xml, tag) { return xml.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">"))?.[1] ?? ""; }
function getAll(xml, tag) { const re = new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">", "g"); const m = []; let x; while ((x = re.exec(xml))) m.push(x[1]); return m; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Step 1: Describe instance
console.log("=== Step 1: Checking instance state ===");
const instXml = await ec2req("DescribeInstances", { "Filter.1.Name": "instance-id", "Filter.1.Value.1": INSTANCE_ID });
const instState = get(instXml, "name");
const currentIp = get(instXml, "ipAddress");
const instType = get(instXml, "instanceType");
console.log(`  State: ${instState} | IP: ${currentIp || "none"} | Type: ${instType}`);

// ── Step 2: List all Elastic IPs
console.log("\n=== Step 2: Listing Elastic IPs ===");
const eipXml = await ec2req("DescribeAddresses");
const eipIps = getAll(eipXml, "publicIp");
const eipAllocs = getAll(eipXml, "allocationId");
const eipAssocs = getAll(eipXml, "associationId");
const eipInstIds = getAll(eipXml, "instanceId");

let unassocAlloc = null, unassocIp = null;
let alreadyAssocToInstance = false;
let instanceEip = null;

eipIps.forEach((ip, i) => {
  const assoc = eipAssocs[i] || "UNASSOCIATED";
  const inst = eipInstIds[i] || "none";
  console.log(`  ${ip} | alloc: ${eipAllocs[i]} | assoc: ${assoc} | inst: ${inst}`);
  if (!eipAssocs[i] && !unassocAlloc) {
    unassocAlloc = eipAllocs[i];
    unassocIp = ip;
  }
  if (inst === INSTANCE_ID) {
    alreadyAssocToInstance = true;
    instanceEip = ip;
    console.log(`  ^^^ Already associated to our instance!`);
  }
});

// ── Step 3: Allocate new EIP if none unassociated
let targetAllocId = unassocAlloc;
let targetIp = unassocIp;

if (alreadyAssocToInstance) {
  console.log(`\nInstance already has EIP ${instanceEip} — no action needed.`);
  targetIp = instanceEip;
} else if (targetAllocId) {
  console.log(`\nFound unassociated EIP ${targetIp} (alloc ${targetAllocId}) — will use it.`);
} else {
  console.log("\nNo free EIP — allocating a new one...");
  const allocXml = await ec2req("AllocateAddress", { Domain: "vpc" });
  targetAllocId = get(allocXml, "allocationId");
  targetIp = get(allocXml, "publicIp");
  if (!targetAllocId) {
    console.error("Failed to allocate EIP:", allocXml.slice(0, 500));
    process.exit(1);
  }
  console.log(`  Allocated: ${targetIp} (alloc ${targetAllocId})`);
}

// ── Step 4: Start instance if stopped
if (!alreadyAssocToInstance) {
  if (instState === "stopped") {
    console.log("\n=== Step 4: Starting stopped instance ===");
    await ec2req("StartInstances", { "InstanceId.1": INSTANCE_ID });
    console.log("  Start requested — waiting for running state...");
    for (let i = 0; i < 30; i++) {
      await sleep(8000);
      const s = await ec2req("DescribeInstances", { "Filter.1.Name": "instance-id", "Filter.1.Value.1": INSTANCE_ID });
      const st = get(s, "name");
      process.stdout.write(`  ${st}...`);
      if (st === "running") { console.log(" UP"); break; }
    }
  } else if (instState === "running") {
    console.log(`\n=== Step 4: Instance already running ===`);
  } else {
    console.log(`\nInstance state is '${instState}' — cannot associate EIP. Please start it manually.`);
    process.exit(1);
  }

  // ── Step 5: Associate EIP
  console.log(`\n=== Step 5: Associating EIP ${targetIp} to instance ${INSTANCE_ID} ===`);
  const assocXml = await ec2req("AssociateAddress", { InstanceId: INSTANCE_ID, AllocationId: targetAllocId, AllowReassociation: "true" });
  const assocId = get(assocXml, "associationId");
  if (assocId) {
    console.log(`  Associated! assocId: ${assocId}`);
  } else {
    console.error("  Association may have failed:", assocXml.slice(0, 500));
  }
}

// ── Step 6: Update Route 53
console.log(`\n=== Step 6: Updating Route 53 ${DOMAIN} → ${targetIp} ===`);
const r53body = `<?xml version="1.0" encoding="UTF-8"?>
<ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <ChangeBatch>
    <Changes>
      <Change>
        <Action>UPSERT</Action>
        <ResourceRecordSet>
          <Name>${DOMAIN}</Name>
          <Type>A</Type>
          <TTL>60</TTL>
          <ResourceRecords>
            <ResourceRecord><Value>${targetIp}</Value></ResourceRecord>
          </ResourceRecords>
        </ResourceRecordSet>
      </Change>
    </Changes>
  </ChangeBatch>
</ChangeResourceRecordSetsRequest>`;

const r53res = await r53req(r53body);
const changeStatus = get(r53res.body, "Status");
console.log(`  Route 53 HTTP ${r53res.status} | status: ${changeStatus}`);

// ── Summary
console.log("\n=== DONE ===");
console.log(`  Elastic IP:  ${targetIp}`);
console.log(`  Domain:      ${DOMAIN} → ${targetIp}`);
console.log(`  SSH:         ssh -i Coxa_Services.pem ubuntu@${targetIp}`);
console.log(`  PostHog:     https://posthog.service.coxa.live`);
