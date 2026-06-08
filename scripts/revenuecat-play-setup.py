#!/usr/bin/env python3
"""RevenueCat v2 — idempotent Play Store catalog setup for BetterAt.

Mirrors scripts/revenuecat-ios-setup (originally /tmp/rc_setup.py) but for the
Google Play side. It:
  1. Finds (or creates) the play_store app on RC project bc3ea4eb.
  2. Creates the 4 Play subscription products.
  3. Attaches them to the EXISTING pro / individual entitlements.
  4. Attaches them to the EXISTING offering packages (so one package serves
     both App Store and Play Store products — do NOT create new packages).

Key read from .env (REVENUECAT_V2_SECRET_KEY); never printed.

PREREQUISITES (must be done in the Google Play Console FIRST — RC products
reference Play products that have to exist):
  * App com.betterat.app created in Play Console.
  * For each tier, a subscription with the product id below and a single base
    plan whose id matches BASE_PLAN. RC's store_identifier for a Play sub is
    "<subscription_id>:<base_plan_id>" — change BASE_PLAN here if you name the
    base plans differently in the Console.
  * A first AAB uploaded to an internal track (Play won't activate the products
    or expose them to RC until a build with the billing entitlement exists).

LIMITATION (same shape as the iOS `appl_` key being manual): the Play service
account credentials upload and the resulting `goog_` public SDK key are NOT
exposed by the v2 API. After this script runs, finish in the RC dashboard:
  Project settings -> Integrations -> Google Play -> upload the service account
  JSON (scripts/../google-play-service-account.json, project regattaflowwebsite,
  needs Play "View financial data" + "Manage orders & subscriptions" roles +
  the Pub/Sub real-time-developer-notifications topic), then
  Project settings -> API keys -> "App-specific public API keys" -> BetterAt
  (Play Store) -> copy the goog_... key into .env as
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY. Then a new Android build + test buy.
"""
import json, urllib.request, urllib.error

ENV = "/Users/kdenney/Developer/BetterAt/betterat-app/.env"
KEY = None
for line in open(ENV):
    if line.startswith("REVENUECAT_V2_SECRET_KEY="):
        KEY = line.split("=", 1)[1].strip()
P = "bc3ea4eb"
BASE = f"https://api.revenuecat.com/v2/projects/{P}"

PACKAGE_NAME = "com.betterat.app"
PLAY_APP_NAME = "BetterAt (Play Store)"

# Play subscription_id -> base plan id. store_identifier = "<sub_id>:<base_plan>".
BASE_PLAN = {
    "betterat_individual_monthly": "monthly",
    "betterat_individual_yearly":  "annual",
    "betterat_pro_monthly":        "monthly",
    "betterat_pro_yearly":         "annual",
}
# subscription_id -> (display, entitlement lookup_key, package lookup_key).
# package lookup_key MUST match the existing iOS packages so one package serves both stores.
PRODUCTS = {
    "betterat_individual_monthly": ("BetterAt Individual Monthly (Play)", "individual", "individual_monthly"),
    "betterat_individual_yearly":  ("BetterAt Individual Yearly (Play)",  "individual", "individual_yearly"),
    "betterat_pro_monthly":        ("BetterAt Pro Monthly (Play)",        "pro",        "pro_monthly"),
    "betterat_pro_yearly":         ("BetterAt Pro Yearly (Play)",         "pro",        "pro_yearly"),
}
OFFERING_ID = "ofrngca51e2e52e"  # default offering (shared with iOS)


def req(method, path, body=None):
    url = path if path.startswith("http") else BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + KEY)
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp:
            b = resp.read()
            return resp.status, (json.loads(b) if b else {})
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, {"raw": b.decode(errors="replace")}


def list_all(ep):
    st, j = req("GET", f"/{ep}?limit=100")
    return j.get("items", []) if st == 200 else []


def play_app_id():
    for a in list_all("apps"):
        if a.get("type") == "play_store":
            return a["id"]
    # Try to create it. RC may reject without credentials; if so, create the
    # Play app manually in the dashboard and re-run (this step turns idempotent).
    st, j = req("POST", "/apps", {
        "type": "play_store",
        "name": PLAY_APP_NAME,
        "play_store": {"package_name": PACKAGE_NAME},
    })
    if st in (200, 201):
        print("play_store app: created", j["id"])
        return j["id"]
    print(f"play_store app: could not auto-create ({st} {json.dumps(j)[:300]}).")
    print("  -> Create it in the RC dashboard (Apps -> + New -> Play Store, "
          f"package {PACKAGE_NAME}, upload the service account), then re-run.")
    raise SystemExit(1)


def main():
    if not KEY:
        raise SystemExit("no REVENUECAT_V2_SECRET_KEY in .env")
    app_id = play_app_id()
    print("Play Store app:", app_id)

    # Entitlements already exist (shared with iOS); look them up, never recreate.
    ent_ids = {e["lookup_key"]: e["id"] for e in list_all("entitlements")}
    for lk in ("pro", "individual"):
        print(f"entitlement {lk}: {'found ' + ent_ids[lk] if lk in ent_ids else 'MISSING — run the iOS setup first'}")

    # 1. Play products
    def sid_of(sub_id):
        return f"{sub_id}:{BASE_PLAN[sub_id]}"
    prod_by_sid = {p.get("store_identifier"): p for p in list_all("products")
                   if (p.get("app_id") == app_id or (p.get("app") or {}).get("id") == app_id)}
    prod_ids = {}
    for sub_id, (disp, _ent, _pkg) in PRODUCTS.items():
        sid = sid_of(sub_id)
        if sid in prod_by_sid:
            prod_ids[sub_id] = prod_by_sid[sid]["id"]
            print(f"product {sid}: exists {prod_ids[sub_id]}")
        else:
            st, j = req("POST", "/products", {
                "store_identifier": sid, "app_id": app_id,
                "type": "subscription", "display_name": disp,
            })
            if st not in (200, 201):
                print(f"product {sid} FAILED {st} {json.dumps(j)[:300]}"); continue
            prod_ids[sub_id] = j["id"]
            print(f"product {sid}: created {j['id']}")

    # 2. attach products to entitlements (additive; iOS products stay attached)
    for lk in ("individual", "pro"):
        if lk not in ent_ids: continue
        want = [prod_ids[s] for s, (_d, ent, _p) in PRODUCTS.items() if ent == lk and s in prod_ids]
        if not want: continue
        st, j = req("POST", f"/entitlements/{ent_ids[lk]}/actions/attach_products", {"product_ids": want})
        print(f"attach->{lk}: {st} {'' if st in (200,201) else json.dumps(j)[:300]}")

    # 3. attach Play products to the EXISTING packages (do not create packages)
    pkg_by_key = {p["lookup_key"]: p for p in list_all(f"offerings/{OFFERING_ID}/packages")}
    for sub_id, (_disp, _ent, pkg_key) in PRODUCTS.items():
        if pkg_key not in pkg_by_key:
            print(f"package {pkg_key}: MISSING (run iOS setup first); skipping attach"); continue
        if sub_id not in prod_ids:
            continue
        pkg_id = pkg_by_key[pkg_key]["id"]
        st, j = req("POST", f"/packages/{pkg_id}/actions/attach_products",
                    {"products": [{"product_id": prod_ids[sub_id], "eligibility_criteria": "all"}]})
        print(f"attach {sid_of(sub_id)}->{pkg_key}: {st} {'' if st in (200,201) else json.dumps(j)[:300]}")


if __name__ == "__main__":
    main()
