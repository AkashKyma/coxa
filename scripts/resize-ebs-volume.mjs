import crypto from "crypto";
import https from "https";
import { loadEnv, requireEnv, envOr } from "./lib/load-env.mjs";

loadEnv();

const KEY_ID = requireEnv("AWS_ACCESS_KEY_ID");
const SECRET = requireEnv("AWS_SECRET_ACCESS_KEY");
const REGION = envOr("AWS_REGION", "us-east-1");
const VOLUME_ID = requireEnv("EBS_VOLUME_ID");
const NEW_SIZE_GB = Number(envOr("EBS_NEW_SIZE_GB", "60"));

function sign(k, m) { return crypto.createHmac("sha256", k).update(m).digest(); }
function sigKey(s, d, r, sv) { return sign(sign(sign(sign("AWS4" + s, d), r), sv), "aws4_request"); }

function ec2(action, extra) {
  return new Promise((res, rej) => {
    const body = new URLSearchParams({ Action: action, Version: "2016-11-15", ...extra }).toString();
    const host = `ec2.${REGION}.amazonaws.com`;
    const now = new Date();
    const amz = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const ds = amz.slice(0, 8);
    const ph = crypto.createHash("sha256").update(body).digest("hex");
    const ch = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amz}\n`;
    const sh = "content-type;host;x-amz-date";
    const cr = ["POST", "/", "", ch, sh, ph].join("\n");
    const cs = `${ds}/${REGION}/ec2/aws4_request`;
    const sts = ["AWS4-HMAC-SHA256", amz, cs, crypto.createHash("sha256").update(cr).digest("hex")].join("\n");
    const sk = sigKey(SECRET, ds, REGION, "ec2");
    const sig = crypto.createHmac("sha256", sk).update(sts).digest("hex");
    const auth = `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${cs}, SignedHeaders=${sh}, Signature=${sig}`;
    const req = https.request({ hostname: host, path: "/", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Amz-Date": amz, Authorization: auth, "Content-Length": Buffer.byteLength(body) } },
      r => { let d = ""; r.on("data", c => d += c); r.on("end", () => res({ status: r.statusCode, body: d })); });
    req.on("error", rej); req.write(body); req.end();
  });
}

console.log(`Resizing volume ${VOLUME_ID} to ${NEW_SIZE_GB} GB...`);
const r = await ec2("ModifyVolume", { VolumeId: VOLUME_ID, Size: NEW_SIZE_GB });
console.log(`HTTP ${r.status}`);
if (r.body.includes("volumeModification")) {
  const state = r.body.match(/<modificationState>([^<]+)<\/modificationState>/)?.[1];
  const progress = r.body.match(/<progress>([^<]+)<\/progress>/)?.[1];
  console.log(`State: ${state}  Progress: ${progress}%`);
  console.log("Volume resize initiated. Run 'sudo growpart /dev/nvme0n1 1 && sudo resize2fs /dev/nvme0n1p1' on the EC2 instance to expand the filesystem.");
} else {
  console.log(r.body.slice(0, 500));
}
