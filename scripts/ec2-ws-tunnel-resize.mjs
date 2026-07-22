/**
 * Opens a local TCP port that proxies to EC2 port 22 via the EIC Endpoint WebSocket tunnel.
 * Then runs SSH through that local port to execute the resize commands.
 *
 * Protocol: Connect to wss://<eic-endpoint>/ with AWS SigV4 presigned URL,
 * then relay bytes between the WebSocket and SSH.
 */
import crypto from "crypto";
import https from "https";
import http from "http";
import net from "net";
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
const SSH_USER = envOr("EC2_SSH_USER", "ubuntu");
const EIC_ENDPOINT_ID = requireEnv("EIC_ENDPOINT_ID");
const LOCAL_PORT = Number(envOr("EIC_LOCAL_PORT", "12222"));

function hmac(key, data, enc) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(enc || undefined);
}
function hash(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function presignEicTunnel() {
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const host = `${EIC_ENDPOINT_ID}.${REGION}.eic.ec2.aws`;
  const queryParams = {
    Action: "OpenTunnel",
    InstanceId: INSTANCE_ID,
    RemotePort: "22",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${AWS_ACCESS_KEY}/${datestamp}/${REGION}/ec2-instance-connect/aws4_request`,
    "X-Amz-Date": amzdate,
    "X-Amz-Expires": "300",
    "X-Amz-SignedHeaders": "host",
  };
  const qs = Object.keys(queryParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join("&");
  const cr = ["GET", "/", qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const cs = `${datestamp}/${REGION}/ec2-instance-connect/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amzdate}\n${cs}\n${hash(cr)}`;
  const sk = hmac(hmac(hmac(hmac(`AWS4${AWS_SECRET_KEY}`, datestamp), REGION), "ec2-instance-connect"), "aws4_request");
  const sig = hmac(sk, sts, "hex");
  return { url: `wss://${host}/?${qs}&X-Amz-Signature=${sig}`, host };
}

function base64Encode(str) { return Buffer.from(str).toString("base64"); }
function randomKey() { return base64Encode(crypto.randomBytes(16)); }

// Minimal WebSocket client (no external deps)
function connectWebSocket(url, hostname) {
  return new Promise((resolve, reject) => {
    const wsKey = randomKey();
    const urlObj = new URL(url.replace("wss://", "https://"));
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        "Host": urlObj.hostname,
        "Upgrade": "websocket",
        "Connection": "Upgrade",
        "Sec-WebSocket-Key": wsKey,
        "Sec-WebSocket-Version": "13",
      },
    };
    const req = https.request(opts);
    req.on("upgrade", (res, socket, head) => {
      const ws = {
        socket,
        send(data) {
          // WebSocket frame: FIN=1, opcode=2 (binary), no mask for server (but we're client so mask required)
          const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
          const len = payload.length;
          const maskKey = crypto.randomBytes(4);
          const masked = Buffer.alloc(len);
          for (let i = 0; i < len; i++) masked[i] = payload[i] ^ maskKey[i % 4];
          let header;
          if (len < 126) {
            header = Buffer.alloc(6);
            header[0] = 0x82; // FIN + binary
            header[1] = 0x80 | len; // MASK + len
            maskKey.copy(header, 2);
          } else if (len < 65536) {
            header = Buffer.alloc(8);
            header[0] = 0x82;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(len, 2);
            maskKey.copy(header, 4);
          } else {
            header = Buffer.alloc(14);
            header[0] = 0x82;
            header[1] = 0x80 | 127;
            header.writeBigUInt64BE(BigInt(len), 2);
            maskKey.copy(header, 10);
          }
          socket.write(Buffer.concat([header, masked]));
        },
        onData: null,
        _buffer: Buffer.alloc(0),
        _parseFrames() {
          while (this._buffer.length >= 2) {
            const fin = (this._buffer[0] & 0x80) !== 0;
            const opcode = this._buffer[0] & 0x0f;
            const masked = (this._buffer[1] & 0x80) !== 0;
            let payloadLen = this._buffer[1] & 0x7f;
            let offset = 2;
            if (payloadLen === 126) {
              if (this._buffer.length < 4) break;
              payloadLen = this._buffer.readUInt16BE(2);
              offset = 4;
            } else if (payloadLen === 127) {
              if (this._buffer.length < 10) break;
              payloadLen = Number(this._buffer.readBigUInt64BE(2));
              offset = 10;
            }
            const maskLen = masked ? 4 : 0;
            if (this._buffer.length < offset + maskLen + payloadLen) break;
            const maskKey = masked ? this._buffer.slice(offset, offset + 4) : null;
            offset += maskLen;
            let payload = this._buffer.slice(offset, offset + payloadLen);
            if (masked) {
              const unmasked = Buffer.alloc(payloadLen);
              for (let i = 0; i < payloadLen; i++) unmasked[i] = payload[i] ^ maskKey[i % 4];
              payload = unmasked;
            }
            this._buffer = this._buffer.slice(offset + payloadLen);
            if (opcode === 8) { socket.destroy(); return; } // close
            if (opcode === 1 || opcode === 2) {
              if (this.onData) this.onData(payload);
            }
          }
        },
      };
      socket.on("data", (chunk) => {
        ws._buffer = Buffer.concat([ws._buffer, chunk]);
        ws._parseFrames();
      });
      if (head && head.length > 0) {
        ws._buffer = Buffer.concat([ws._buffer, head]);
        ws._parseFrames();
      }
      resolve(ws);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => reject(new Error("WebSocket connect timeout")));
    req.end();
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
echo "FS: $FS"
if [ "$FS" = "xfs" ]; then sudo xfs_growfs /; else sudo resize2fs $PART_DEV; fi
echo ""
echo "=== DISK AFTER ==="
df -h /
echo "=== Docker ==="
sudo docker system df 2>/dev/null || true
echo "=== Services ==="
sudo docker ps --format "table {{.Names}}\\t{{.Status}}" 2>/dev/null || true
`.trim();

async function main() {
  console.log("🔗 Generating presigned EIC tunnel URL...");
  const { url, host } = presignEicTunnel();
  console.log(`   Endpoint host: ${host}`);

  console.log("🌐 Opening WebSocket tunnel to EC2 port 22...");
  let ws;
  try {
    ws = await connectWebSocket(url, host);
    console.log("   ✅ WebSocket tunnel established.");
  } catch (e) {
    console.error("   ❌ WebSocket tunnel failed:", e.message);
    console.log("\n💡 The EIC Endpoint tunnel connection failed.");
    console.log("   This is likely because the EC2 security group does not have a rule allowing");
    console.log("   the EIC Endpoint service IP range to reach port 22.");
    console.log("\n   Please connect manually via the AWS Console:");
    console.log("   https://us-east-1.console.aws.amazon.com/ec2/home#Instances:");
    console.log("   Select i-09ec7300ad9e03274 → Connect → EC2 Instance Connect");
    return;
  }

  // Create a local TCP server that bridges to the WebSocket
  const server = net.createServer((sock) => {
    console.log("   Local TCP connection received — bridging to WebSocket...");
    sock.on("data", (data) => ws.send(data));
    ws.onData = (data) => sock.write(data);
    ws.socket.on("close", () => sock.destroy());
    sock.on("close", () => { try { ws.socket.destroy(); } catch {} });
  });

  await new Promise((resolve) => server.listen(LOCAL_PORT, "127.0.0.1", resolve));
  console.log(`   Local proxy listening on port ${LOCAL_PORT}`);

  // Generate temp SSH key
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eic-"));
  const keyPath = path.join(tmpDir, "key");
  spawnSync("ssh-keygen", ["-t", "rsa", "-b", "2048", "-f", keyPath, "-N", "", "-q"], { stdio: "inherit" });

  console.log("\n🖥️  Running SSH through local proxy tunnel...");
  const sshResult = spawnSync("ssh", [
    "-i", keyPath,
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=/dev/null",
    "-o", "ConnectTimeout=15",
    "-p", String(LOCAL_PORT),
    `${SSH_USER}@127.0.0.1`,
    "bash -s",
  ], {
    input: RESIZE_SCRIPT,
    encoding: "utf8",
    timeout: 90000,
  });

  server.close();
  fs.rmSync(tmpDir, { recursive: true });

  if (sshResult.stdout) console.log("\n" + sshResult.stdout);
  if (sshResult.stderr && !sshResult.stderr.includes("Warning:")) console.log("STDERR:", sshResult.stderr);
  if (sshResult.status === 0) {
    console.log("\n✅ Filesystem resize complete!");
  } else {
    console.error(`\n❌ SSH failed (exit ${sshResult.status})`);
    if (sshResult.error) console.error(sshResult.error.message);
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
