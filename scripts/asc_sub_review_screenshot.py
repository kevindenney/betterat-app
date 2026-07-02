#!/usr/bin/env python3
"""
Upload an App Store Connect subscription "review screenshot" to one or more
auto-renewable subscription products, clearing the MISSING_METADATA screenshot
requirement. The same image is uploaded to every target product.

Auth reuses the App Manager key already on disk (B9GW6LC36M). The .p8 is the
secret and stays in ~/.appstoreconnect/private_keys/ — never copied.

Three-step ASC upload per product:
  1. POST /v1/subscriptionAppStoreReviewScreenshots  (reserve, get uploadOperations)
  2. PUT bytes to each uploadOperation URL (with its prescribed headers)
  3. PATCH .../{id} {uploaded: true, sourceFileChecksum: <md5>}

Usage:
  python3 scripts/asc_sub_review_screenshot.py /path/to/paywall.png
  python3 scripts/asc_sub_review_screenshot.py /path/to/paywall.png --only betterat_pro_monthly
  python3 scripts/asc_sub_review_screenshot.py --status            # just show current state
"""
import argparse
import hashlib
import json
import os
import sys
import time
import http.client
import urllib.parse

import jwt  # PyJWT

KEY_ID = "B9GW6LC36M"
ISSUER = "c0364ef0-3b34-40f7-b792-3400b83c64e4"
P8 = os.path.expanduser("~/.appstoreconnect/private_keys/AuthKey_B9GW6LC36M.p8")
HOST = "api.appstoreconnect.apple.com"

# Subscription resource IDs in group "BetterAt Membership" (22141332)
SUBSCRIPTIONS = {
    "betterat_individual_monthly": "6777852073",
    "betterat_individual_yearly": "6777852211",
    "betterat_pro_monthly": "6777852098",
    "betterat_pro_yearly": "6777851908",
}


def token():
    now = int(time.time())
    return jwt.encode(
        {"iss": ISSUER, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        open(P8).read(),
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )


def api(method, path, body=None, tok=None):
    conn = http.client.HTTPSConnection(HOST)
    headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    conn.request(method, path, body=json.dumps(body) if body is not None else None, headers=headers)
    r = conn.getresponse()
    raw = r.read().decode()
    return r.status, (json.loads(raw) if raw else {})


def put_bytes(url, headers, data):
    u = urllib.parse.urlparse(url)
    conn = http.client.HTTPSConnection(u.netloc)
    path = u.path + ("?" + u.query if u.query else "")
    h = {hh["name"]: hh["value"] for hh in headers}
    conn.request("PUT", path, body=data, headers=h)
    r = conn.getresponse()
    r.read()
    return r.status


def show_status(tok):
    for product_id, sub_id in SUBSCRIPTIONS.items():
        st, sub = api("GET", f"/v1/subscriptions/{sub_id}", tok=tok)
        state = sub.get("data", {}).get("attributes", {}).get("state", "?")
        st2, sc = api("GET", f"/v1/subscriptions/{sub_id}/appStoreReviewScreenshot", tok=tok)
        has = bool(sc.get("data"))
        fn = sc.get("data", {}).get("attributes", {}).get("fileName") if has else None
        print(f"  {product_id:32s} state={state:18s} screenshot={'YES (' + str(fn) + ')' if has else 'NONE'}")


def upload_one(tok, product_id, sub_id, path, blob, md5):
    file_name = os.path.basename(path)
    # 1. reserve
    st, resp = api(
        "POST",
        "/v1/subscriptionAppStoreReviewScreenshots",
        {
            "data": {
                "type": "subscriptionAppStoreReviewScreenshots",
                "attributes": {"fileName": file_name, "fileSize": len(blob)},
                "relationships": {"subscription": {"data": {"type": "subscriptions", "id": sub_id}}},
            }
        },
        tok=tok,
    )
    if st not in (200, 201):
        print(f"  ✗ {product_id}: reserve failed ({st}): {json.dumps(resp)[:300]}")
        return False
    res_id = resp["data"]["id"]
    ops = resp["data"]["attributes"]["uploadOperations"]
    # 2. upload bytes (usually a single operation for a small image)
    for op in ops:
        chunk = blob[op["offset"]: op["offset"] + op["length"]]
        code = put_bytes(op["url"], op["requestHeaders"], chunk)
        if code not in (200, 201):
            print(f"  ✗ {product_id}: byte upload failed ({code})")
            return False
    # 3. commit
    st, _ = api(
        "PATCH",
        f"/v1/subscriptionAppStoreReviewScreenshots/{res_id}",
        {
            "data": {
                "type": "subscriptionAppStoreReviewScreenshots",
                "id": res_id,
                "attributes": {"uploaded": True, "sourceFileChecksum": md5},
            }
        },
        tok=tok,
    )
    if st != 200:
        print(f"  ✗ {product_id}: commit failed ({st})")
        return False
    print(f"  ✓ {product_id}: uploaded {file_name}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image", nargs="?", help="Path to the paywall screenshot (PNG/JPG)")
    ap.add_argument("--only", help="Upload to a single product id only")
    ap.add_argument("--status", action="store_true", help="Show current screenshot state and exit")
    args = ap.parse_args()

    tok = token()

    if args.status or not args.image:
        print("Current subscription review-screenshot state:")
        show_status(tok)
        if not args.image:
            return

    blob = open(args.image, "rb").read()
    md5 = hashlib.md5(blob).hexdigest()
    print(f"\nImage: {args.image}  ({len(blob)} bytes, md5 {md5})")

    targets = SUBSCRIPTIONS
    if args.only:
        if args.only not in SUBSCRIPTIONS:
            sys.exit(f"Unknown product id {args.only}. Known: {', '.join(SUBSCRIPTIONS)}")
        targets = {args.only: SUBSCRIPTIONS[args.only]}

    print("Uploading...")
    ok = all(upload_one(tok, pid, sid, args.image, blob, md5) for pid, sid in targets.items())

    print("\nResulting state:")
    show_status(tok)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
