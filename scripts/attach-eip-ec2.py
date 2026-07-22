#!/usr/bin/env python3
import urllib.request, urllib.parse, re, hmac, hashlib, datetime, ssl
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from load_env import load_env, require_env, env_or

load_env()

KEY = require_env("AWS_ACCESS_KEY_ID")
SECRET = require_env("AWS_SECRET_ACCESS_KEY")
REGION = env_or("AWS_REGION", "us-east-1")
INSTANCE_ID = require_env("EC2_INSTANCE_ID")
ZONE_ID = require_env("ROUTE53_ZONE_ID")
DOMAIN = env_or("POSTHOG_DOMAIN", "posthog.service.coxa.live")

def sign(key, msg):
    if isinstance(key, str):
        key = key.encode()
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

print("=== Step 1: Listing Elastic IPs ===")
eip_xml = ec2_req("DescribeAddresses")
ips = getall(eip_xml, "publicIp")
allocs = getall(eip_xml, "allocationId")
assocs = getall(eip_xml, "associationId")
insts = getall(eip_xml, "instanceId")

free_alloc = None
free_ip = None
inst_eip = None

for i, ip in enumerate(ips):
    a = allocs[i] if i < len(allocs) else ""
    c = assocs[i] if i < len(assocs) else ""
    n = insts[i] if i < len(insts) else ""
    status = "FREE" if not c else f"assoc={c}"
    print(f"  {ip}  alloc={a}  {status}  inst={n or 'none'}")
    if not c and not free_alloc:
        free_alloc = a
        free_ip = ip
    if n == INSTANCE_ID:
        inst_eip = ip
        print(f"  ^^^ Already attached to our instance!")

target_ip = None
target_alloc = None

if inst_eip:
    print(f"\nInstance already has EIP {inst_eip} -- skipping association.")
    target_ip = inst_eip
elif free_alloc:
    print(f"\nUsing free EIP {free_ip} (alloc {free_alloc})")
    target_ip = free_ip
    target_alloc = free_alloc
else:
    print("\n=== Allocating new EIP ===")
    r = ec2_req("AllocateAddress", {"Domain": "vpc"})
    target_alloc = get(r, "allocationId")
    target_ip = get(r, "publicIp")
    if not target_alloc:
        print(f"Failed: {r[:400]}")
        exit(1)
    print(f"  Allocated {target_ip} ({target_alloc})")

if not inst_eip and target_alloc:
    print(f"\n=== Associating {target_ip} to instance {INSTANCE_ID} ===")
    r = ec2_req("AssociateAddress", {"InstanceId": INSTANCE_ID, "AllocationId": target_alloc, "AllowReassociation": "true"})
    assoc_id = get(r, "associationId")
    if assoc_id:
        print(f"  Success! associationId={assoc_id}")
    else:
        print(f"  Possible failure: {r[:300]}")

# Update Route 53
print(f"\n=== Updating Route 53: {DOMAIN} -> {target_ip} ===")
now = datetime.datetime.utcnow()
date = now.strftime("%Y%m%d")
ts = now.strftime("%Y%m%dT%H%M%SZ")

r53_body = f"""<?xml version="1.0"?>
<ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <ChangeBatch><Changes><Change><Action>UPSERT</Action>
    <ResourceRecordSet><Name>{DOMAIN}</Name><Type>A</Type><TTL>60</TTL>
    <ResourceRecords><ResourceRecord><Value>{target_ip}</Value></ResourceRecord></ResourceRecords>
  </ResourceRecordSet></Change></Changes></ChangeBatch>
</ChangeResourceRecordSetsRequest>"""

path = f"/2013-04-01/hostedzone/{ZONE_ID}/rrset/"
bh = hashlib.sha256(r53_body.encode()).hexdigest()
h = {"content-type": "application/xml", "host": "route53.amazonaws.com", "x-amz-date": ts, "x-amz-content-sha256": bh}
sh = sorted(h.keys())
hs = "\n".join(f"{k}:{h[k]}" for k in sh)
sk = ";".join(sh)
cr = f"POST\n{path}\n\n{hs}\n\n{sk}\n{bh}"
ss = f"AWS4-HMAC-SHA256\n{ts}\n{date}/{REGION}/route53/aws4_request\n{hashlib.sha256(cr.encode()).hexdigest()}"
sig = hmac.new(sig_key(SECRET, date, REGION, "route53"), ss.encode(), hashlib.sha256).hexdigest()
auth = f"AWS4-HMAC-SHA256 Credential={KEY}/{date}/{REGION}/route53/aws4_request, SignedHeaders={sk}, Signature={sig}"

req = urllib.request.Request(
    f"https://route53.amazonaws.com{path}",
    data=r53_body.encode(),
    headers={**h, "authorization": auth},
    method="POST"
)
try:
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        resp = r.read().decode()
        status = get(resp, "Status")
        print(f"  Route 53 updated. Status={status}")
except Exception as e:
    print(f"  Route 53 error: {e}")

print(f"\n{'='*50}")
print(f"  Elastic IP : {target_ip}")
print(f"  Domain     : {DOMAIN}")
print(f"  SSH        : ssh -i Coxa_Services.pem ubuntu@{target_ip}")
print(f"  PostHog    : https://posthog.service.coxa.live")
print(f"{'='*50}")
