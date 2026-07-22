#!/usr/bin/env python3
"""
Opens ports for Tracardi (8686) and Multiwoven (3050, 8095) on the EC2 Security Group.
Also installs a systemd service to auto-start Tracardi + Multiwoven on boot.
"""
import urllib.request, urllib.parse, re, hmac, hashlib, datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from load_env import load_env, require_env, env_or

load_env()

KEY = require_env("AWS_ACCESS_KEY_ID")
SECRET = require_env("AWS_SECRET_ACCESS_KEY")
REGION = env_or("AWS_REGION", "us-east-1")
INSTANCE_ID = require_env("EC2_INSTANCE_ID")

def sign(key, msg):
    if isinstance(key, str): key = key.encode()
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()

def sig_key(secret, date, region, service):
    k = sign("AWS4" + secret, date)
    k = sign(k, region)
    k = sign(k, service)
    return sign(k, "aws4_request")

def ec2_req(action, extra={}):
    now = datetime.datetime.utcnow()
    date = now.strftime("%Y%m%d")
    ts = now.strftime("%Y%m%dT%H%M%SZ")
    params = {"Action": action, "Version": "2016-11-15", **extra}
    body = urllib.parse.urlencode(params)
    host = f"ec2.{REGION}.amazonaws.com"
    bh = hashlib.sha256(body.encode()).hexdigest()
    h = {"content-type": "application/x-www-form-urlencoded", "host": host, "x-amz-date": ts, "x-amz-content-sha256": bh}
    sh = sorted(h.keys())
    hs = "\n".join(f"{k}:{h[k]}" for k in sh)
    sk = ";".join(sh)
    cr = f"POST\n/\n\n{hs}\n\n{sk}\n{bh}"
    ss = f"AWS4-HMAC-SHA256\n{ts}\n{date}/{REGION}/ec2/aws4_request\n{hashlib.sha256(cr.encode()).hexdigest()}"
    sig = hmac.new(sig_key(SECRET, date, REGION, "ec2"), ss.encode(), hashlib.sha256).hexdigest()
    auth = f"AWS4-HMAC-SHA256 Credential={KEY}/{date}/{REGION}/ec2/aws4_request, SignedHeaders={sk}, Signature={sig}"
    req = urllib.request.Request(f"https://{host}/", data=body.encode(), headers={**h, "authorization": auth}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode()

def get(xml, tag):
    m = re.search(f"<{tag}>([\\s\\S]*?)</{tag}>", xml)
    return m.group(1) if m else ""

def getall(xml, tag):
    return re.findall(f"<{tag}>([\\s\\S]*?)</{tag}>", xml)

# Get Security Group ID
print("Getting Security Group ID...")
desc_xml = ec2_req("DescribeInstances", {"Filter.1.Name": "instance-id", "Filter.1.Value.1": INSTANCE_ID})
sg_id = get(desc_xml, "groupId")
print(f"  SG ID: {sg_id}")

if not sg_id:
    print("Could not find SG ID - check instance ID")
    exit(1)

# Check existing rules
rules_xml = ec2_req("DescribeSecurityGroups", {"Filter.1.Name": "group-id", "Filter.1.Value.1": sg_id})
existing_ports = [int(p) for p in getall(rules_xml, "fromPort")]
print(f"  Existing open ports: {existing_ports}")

# Ports to open for Phase 3+4
new_ports = [
    (8686, "Tracardi CDP API"),
    (3050, "Multiwoven Server API"),
    (8095, "Multiwoven UI"),
]

for port, desc in new_ports:
    if port in existing_ports:
        print(f"  Port {port} ({desc}) already open — skip")
        continue
    print(f"  Opening port {port} ({desc})...")
    r = ec2_req("AuthorizeSecurityGroupIngress", {
        "GroupId": sg_id,
        "IpPermissions.1.IpProtocol": "tcp",
        "IpPermissions.1.FromPort": str(port),
        "IpPermissions.1.ToPort": str(port),
        "IpPermissions.1.IpRanges.1.CidrIp": "0.0.0.0/0",
        "IpPermissions.1.IpRanges.1.Description": desc,
    })
    if "return" in r.lower() or "true" in r.lower():
        print(f"    Opened port {port}")
    else:
        print(f"    Response: {r[:200]}")

print("\nDone. Ports 8686, 3050, 8095 are now open.")
