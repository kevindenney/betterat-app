#!/usr/bin/env python3
"""Google Play Console CLI for BetterAt (androidpublisher v3).

Default package: at.better.app (fresh app on the Oceanflow Limited Play
account). The original com.betterat.app lives on the old personal account
(never published) — reach it with --package com.betterat.app.

Auth: google-play-service-account.json in the repo root (gitignored).

Commands:
  status                              show releases on every track
  upload <aab> [--track internal]    upload AAB + assign to track + commit
  promote <versionCode> --to <track> [--rollout 0.x]
  listing                             show the store listing
  images <imageType> <files...>       replace images for an image type
                                      (phoneScreenshots, sevenInchScreenshots,
                                       tenInchScreenshots, icon, featureGraphic)
  push-listing <exportDir> [--images-dir d]
                                      apply an exported listing.json (details +
                                      listing text + images matched by sha256)
                                      to the target app — use with --package to
                                      copy the store to another app

Global: --package <pkg> targets a different app (default com.betterat.app).

Uploads are SINGLE-SHOT (resumable=False) on a long-timeout Http: the
chunked/resumable path hits an httplib2 308 RedirectMissingLocation bug.
"""

import argparse
import glob
import hashlib
import json
import os
import sys

import httplib2
import google_auth_httplib2
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SA = os.path.join(REPO_ROOT, "google-play-service-account.json")
PKG = "at.better.app"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]
DEFAULT_LANG = "en-US"


def service():
    creds = service_account.Credentials.from_service_account_file(SA, scopes=SCOPES)
    http = google_auth_httplib2.AuthorizedHttp(creds, http=httplib2.Http(timeout=600))
    return build("androidpublisher", "v3", http=http, cache_discovery=False)


def cmd_status(_args):
    edits = service().edits()
    eid = edits.insert(packageName=PKG, body={}).execute()["id"]
    try:
        tracks = edits.tracks().list(packageName=PKG, editId=eid).execute()
        for t in tracks.get("tracks", []):
            releases = t.get("releases") or []
            if not releases:
                print(f"{t['track']}: (empty)")
            for r in releases:
                frac = r.get("userFraction")
                rollout = f" rollout={frac}" if frac else ""
                print(
                    f"{t['track']}: {r.get('status')} {r.get('name')} "
                    f"codes={r.get('versionCodes')}{rollout}"
                )
    finally:
        edits.delete(packageName=PKG, editId=eid).execute()


def cmd_upload(args):
    if not os.path.exists(args.aab):
        sys.exit(f"AAB not found: {args.aab}")
    edits = service().edits()
    eid = edits.insert(packageName=PKG, body={}).execute()["id"]
    print(f"edit {eid}: uploading {args.aab} (single-shot)...")
    media = MediaFileUpload(args.aab, mimetype="application/octet-stream", resumable=False)
    vc = edits.bundles().upload(packageName=PKG, editId=eid, media_body=media).execute()[
        "versionCode"
    ]
    print(f"uploaded versionCode {vc}; assigning to '{args.track}'...")
    edits.tracks().update(
        packageName=PKG,
        editId=eid,
        track=args.track,
        body={
            "track": args.track,
            "releases": [
                {"name": args.name or f"({vc})", "versionCodes": [str(vc)], "status": "completed"}
            ],
        },
    ).execute()
    edits.commit(packageName=PKG, editId=eid).execute()
    print(f"done: versionCode {vc} live on {args.track}")


def cmd_promote(args):
    edits = service().edits()
    eid = edits.insert(packageName=PKG, body={}).execute()["id"]
    release = {
        "name": args.name or f"({args.version_code})",
        "versionCodes": [str(args.version_code)],
        "status": "inProgress" if args.rollout else "completed",
    }
    if args.rollout:
        release["userFraction"] = args.rollout
    edits.tracks().update(
        packageName=PKG, editId=eid, track=args.to, body={"track": args.to, "releases": [release]}
    ).execute()
    edits.commit(packageName=PKG, editId=eid).execute()
    rollout = f" at {args.rollout:.0%}" if args.rollout else ""
    print(f"done: versionCode {args.version_code} -> {args.to}{rollout}")


def cmd_listing(_args):
    edits = service().edits()
    eid = edits.insert(packageName=PKG, body={}).execute()["id"]
    try:
        listings = edits.listings().list(packageName=PKG, editId=eid).execute()
        for l in listings.get("listings", []):
            print(f"[{l['language']}] {l.get('title')}")
            print(f"  short: {l.get('shortDescription')}")
            full = l.get("fullDescription") or ""
            print(f"  full ({len(full)} chars): {full[:160]}{'…' if len(full) > 160 else ''}")
    finally:
        edits.delete(packageName=PKG, editId=eid).execute()


def cmd_images(args):
    edits = service().edits()
    eid = edits.insert(packageName=PKG, body={}).execute()["id"]
    print(f"replacing {args.image_type} ({len(args.files)} file(s))...")
    edits.images().deleteall(
        packageName=PKG, editId=eid, language=DEFAULT_LANG, imageType=args.image_type
    ).execute()
    for path in args.files:
        media = MediaFileUpload(path, mimetype="image/png", resumable=False)
        edits.images().upload(
            packageName=PKG,
            editId=eid,
            language=DEFAULT_LANG,
            imageType=args.image_type,
            media_body=media,
        ).execute()
        print(f"  uploaded {os.path.basename(path)}")
    edits.commit(packageName=PKG, editId=eid).execute()
    print("done")


def cmd_push_listing(args):
    with open(os.path.join(args.export_dir, "listing.json")) as f:
        exp = json.load(f)
    edits = service().edits()
    eid = edits.insert(packageName=PKG, body={}).execute()["id"]
    print(f"edit {eid}: pushing listing to {PKG}...")

    edits.details().update(packageName=PKG, editId=eid, body=exp["details"]).execute()
    print(f"  details: {exp['details']}")

    for l in exp["listings"].get("listings", []):
        body = {
            k: l[k]
            for k in ("language", "title", "shortDescription", "fullDescription", "video")
            if l.get(k)
        }
        edits.listings().update(
            packageName=PKG, editId=eid, language=l["language"], body=body
        ).execute()
        print(f"  listing [{l['language']}]: {l.get('title')}")

    if args.images_dir:
        by_sha = {}
        for path in glob.glob(os.path.join(args.images_dir, "*")):
            with open(path, "rb") as f:
                by_sha[hashlib.sha256(f.read()).hexdigest()] = path
        for itype, imgs in exp.get("images", {}).items():
            if not isinstance(imgs, list):
                continue
            paths = []
            for im in imgs:
                path = by_sha.get(im.get("sha256"))
                if not path:
                    sys.exit(f"no local file in {args.images_dir} matches {itype} sha {im.get('sha256')[:12]}…")
                paths.append(path)
            edits.images().deleteall(
                packageName=PKG, editId=eid, language=DEFAULT_LANG, imageType=itype
            ).execute()
            for path in paths:
                media = MediaFileUpload(path, mimetype="image/png", resumable=False)
                edits.images().upload(
                    packageName=PKG,
                    editId=eid,
                    language=DEFAULT_LANG,
                    imageType=itype,
                    media_body=media,
                ).execute()
                print(f"  {itype}: {os.path.basename(path)}")

    edits.commit(packageName=PKG, editId=eid).execute()
    print("done")


def main():
    global PKG
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--package", default=PKG)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status").set_defaults(fn=cmd_status)

    up = sub.add_parser("upload")
    up.add_argument("aab")
    up.add_argument("--track", default="internal")
    up.add_argument("--name", default=None)
    up.set_defaults(fn=cmd_upload)

    pr = sub.add_parser("promote")
    pr.add_argument("version_code", type=int)
    pr.add_argument("--to", required=True, choices=["internal", "alpha", "beta", "production"])
    pr.add_argument("--rollout", type=float, default=None, help="staged rollout fraction, e.g. 0.1")
    pr.add_argument("--name", default=None)
    pr.set_defaults(fn=cmd_promote)

    sub.add_parser("listing").set_defaults(fn=cmd_listing)

    im = sub.add_parser("images")
    im.add_argument("image_type")
    im.add_argument("files", nargs="+")
    im.set_defaults(fn=cmd_images)

    pl = sub.add_parser("push-listing")
    pl.add_argument("export_dir")
    pl.add_argument("--images-dir", default=None)
    pl.set_defaults(fn=cmd_push_listing)

    args = p.parse_args()
    PKG = args.package
    args.fn(args)


if __name__ == "__main__":
    main()
