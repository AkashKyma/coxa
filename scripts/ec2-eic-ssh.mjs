/**
 * ec2-eic-ssh.mjs
 * Pushes a temporary public key via EC2 Instance Connect API,
 * then runs Docker commands on EC2 via SSH.
 */
import crypto from "crypto";
import https  from "https";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const KEY_ID     = requireEnv("AWS_ACCESS_KEY_ID");
const SECRET     = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION     = envOr("AWS_REGION", "us-east-1");
const INSTANCE   = requireEnv("EC2_INSTANCE_ID");
const EC2_IP     = requireEnv("EC2_PUBLIC_IP");
const WORK_DIR   = envOr("EC2_WORK_DIR", "/home/ubuntu/coxa-1touch");
const KEY_PATH   = join(tmpdir(), "coxa_temp_key");
const PUB_PATH   = KEY_PATH + ".pub";

// ── SigV4 ─────────────────────────────────────────────────────────────────────
function hmac(key, data) { return crypto.createHmac("sha256", key).update(data).digest(); }
function hash(s)         { return crypto.createHash("sha256").update(s).digest("hex"); }
function sigKey(s, d, r, svc) { return hmac(hmac(hmac(hmac("AWS4"+s,d),r),svc),"aws4_request"); }

function awsPost(service, host, body, target) {
  return new Promise((resolve, reject) => {
    const now   = new Date();
    const amzdt = now.toISOString().replace(/[:\-]|\.\d{3}/g,"").slice(0,15)+"Z";
    const ds    = amzdt.slice(0,8);
    const ct    = "application/json";
    const ph    = hash(body);

    const raw = { "content-type":ct, "host":host, "x-amz-date":amzdt, ...(target?{"x-amz-target":target}:{}) };
    const sh  = Object.keys(raw).sort().join(";");
    const hs  = Object.keys(raw).sort().map(k=>`${k}:${raw[k]}`).join("\n")+"\n";
    const cr  = ["POST","/","",hs,sh,ph].join("\n");
    const cs  = `${ds}/${REGION}/${service}/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256",amzdt,cs,hash(cr)].join("\n");
    const sig = crypto.createHmac("sha256",sigKey(SECRET,ds,REGION,service)).update(sts).digest("hex");
    const auth= `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${cs},SignedHeaders=${sh},Signature=${sig}`;

    const reqH = Object.assign({},raw);
    reqH["Authorization"] = auth;
    reqH["Content-Length"] = Buffer.byteLength(body).toString();
    if (target) reqH["x-amz-target"] = target;

    const req = https.request({hostname:host,path:"/",method:"POST",headers:reqH},(res)=>{
      let buf=""; res.on("data",c=>buf+=c); res.on("end",()=>resolve({status:res.statusCode,body:buf}));
    });
    req.on("error",reject);
    req.write(body); req.end();
  });
}

// ── 1. Push public key via EC2 Instance Connect ───────────────────────────────
console.log("=== Pushing temporary SSH key via EC2 Instance Connect ===");
const pubKey = readFileSync(PUB_PATH, "utf8").trim();

const eicResp = await awsPost(
  "ec2-instance-connect",
  `ec2-instance-connect.${REGION}.amazonaws.com`,
  JSON.stringify({ InstanceId: INSTANCE, InstanceOSUser: "ubuntu", SSHPublicKey: pubKey }),
);

console.log(`   EIC response: HTTP ${eicResp.status}`);
const eicBody = JSON.parse(eicResp.body);
console.log(`   Success: ${eicBody.Success ?? "unknown"}`);

if (!eicBody.Success && eicResp.status !== 200) {
  console.error("   ✗ EIC failed:", eicResp.body);
  process.exit(1);
}

console.log("   ✓ Key pushed — valid for 60 seconds\n");

// ── 2. SSH into EC2 and run Docker commands ───────────────────────────────────
const REMOTE_COMMANDS = [
  `cd ${WORK_DIR}`,
  "echo '=== Disk & Docker status ==='",
  "df -h / | tail -1",
  "docker ps --format 'table {{.Names}}\\t{{.Status}}' 2>/dev/null | head -30",
  "echo ''",
  "echo '=== Pulling tracardi-gui (new container) ==='",
  "docker compose -f docker-compose.tracardi.yml --env-file .env.cdp pull tracardi-gui 2>&1 || true",
  "echo '=== Starting Tracardi stack with GUI ==='",
  "docker compose -f docker-compose.tracardi.yml --env-file .env.cdp up -d --remove-orphans 2>&1",
  "echo ''",
  "echo '=== Restarting Caddy (new virtual hosts for Tracardi HTTPS) ==='",
  "docker compose -f docker-compose.cdp.yml --env-file .env.cdp restart posthog-proxy 2>&1",
  "sleep 20",
  "echo ''",
  "echo '=== All running containers ==='",
  "docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}' 2>/dev/null",
  "echo ''",
  "echo '=== HTTPS endpoint checks ==='",
  "curl -sk -o /dev/null -w 'posthog           -> HTTP %{http_code}\\n' https://posthog.service.coxa.live/api/users/@me/ || true",
  "curl -sk -o /dev/null -w 'tracardi GUI      -> HTTP %{http_code}\\n' https://tracardi.service.coxa.live/ || true",
  "curl -sk -o /dev/null -w 'tracardi API      -> HTTP %{http_code}\\n' https://tracardi-api.service.coxa.live/healthcheck || true",
  "echo ''",
  "echo '✅ Done'",
].join(" && ");

const sshCmd = [
  "ssh",
  "-i", KEY_PATH,
  "-o", "StrictHostKeyChecking=no",
  "-o", "ConnectTimeout=15",
  "-o", "ServerAliveInterval=10",
  `ubuntu@${EC2_IP}`,
  `bash -lc "${REMOTE_COMMANDS.replace(/"/g, '\\"')}"`
].join(" ");

console.log("=== Connecting via SSH ===\n");
try {
  execSync(sshCmd, { stdio: "inherit", timeout: 180000 });
} catch (err) {
  console.error("\n✗ SSH command failed. Exit code:", err.status);
  process.exit(err.status ?? 1);
}
