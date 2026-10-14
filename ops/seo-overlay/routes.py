"""Manage only explicit RelayWA public marketing routes; never replace the live app Worker."""
import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path

SCRIPT = "relaywa-seo-pages"
PATHS = [
  "/whatsapp-api-qr-code",
  "/whatsapp-webhooks",
  "/guides/whatsapp-web-vs-cloud-api",
  "/sitemap.xml",
  # Exact marketing HTML URLs, no private account routes or wildcard:
  "/",
  "/pricing",
  "/api-docs",
  "/help",
  "/blog",
  "/blog/nodejs-whatsapp-api-send-webhooks",
  "/blog/laravel-whatsapp-api-order-notifications",
  "/blog/whatsapp-api-qr-session-troubleshooting",
  # Same-origin static resources for the message (CSP-compatible):
  "/relaywa-cookie-message.js",
  "/relaywa-cookie-message.css",
]
PATTERNS = ["relaywa.com" + path for path in PATHS]
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
STATE = Path("/tmp/relaywa-seo-new-routes.json")

def call(method, path, data=None):
    payload = json.dumps(data).encode() if data is not None else None
    headers = {"Authorization": "Bearer " + TOKEN, "Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = Request("https://api.cloudflare.com/client/v4/" + path,
                  headers=headers, method=method, data=payload)
    try:
        with urlopen(req, timeout=30) as response:
            obj = json.load(response)
        if not obj.get("success"):
            raise RuntimeError("Cloudflare API reported unsuccessful response")
        return obj.get("result")
    except HTTPError as err:
        # Never log response bodies, which may echo request arguments or secrets.
        raise RuntimeError("Cloudflare API " + method + " " + path.split("?")[0] +
                           " returned HTTP " + str(err.code)) from None
    except URLError as err:
        raise RuntimeError("Cloudflare API connection failed (" + type(err).__name__ + ")") from None

def zone():
    zones = call("GET", "zones?name=relaywa.com")
    matches = [x for x in zones if x.get("name") == "relaywa.com" and
               x.get("status") == "active" and x.get("account", {}).get("id") == ACCOUNT]
    if len(matches) != 1:
        raise RuntimeError("Expected precisely one active relaywa.com zone in the connected Cloudflare account")
    return matches[0]["id"]

def all_routes(zone_id):
    records = call("GET", "zones/" + zone_id + "/workers/routes?per_page=100")
    if not isinstance(records, list):
        raise RuntimeError("Cloudflare Worker route list unavailable")
    return records

def safe_checks(records):
    for item in records:
        if item.get("pattern") in PATTERNS and item.get("script") != SCRIPT:
            raise RuntimeError("Refusing to overwrite a Worker route owned by " +
                               str(item.get("script"))[:60] + ": " + str(item["pattern"])[:120])
    # Do not touch any broad hostname routes, any APIs, or existing custom domains.
    for pattern in PATTERNS:
        assert not pattern.endswith("/*")
        assert "api.relaywa.com" not in pattern and "platform.relaywa.com" not in pattern

def persist(added):
    STATE.write_text(json.dumps(added))

def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ""
    if action not in ("check", "apply", "rollback", "verify"):
        raise RuntimeError("Usage: routes.py check|apply|rollback|verify")
    if not TOKEN or not ACCOUNT:
        raise RuntimeError("GitHub Cloudflare secrets unavailable")
    zid = zone()
    domains = call("GET", "accounts/" + ACCOUNT + "/workers/domains")
    matches = [x for x in domains if x.get("hostname") == "relaywa.com"]
    if len(matches) != 1 or matches[0].get("service") != "relaywa-web":
        raise RuntimeError("Live relaywa.com custom domain is no longer owned by relaywa-web; refusing release")
    items = all_routes(zid)
    safe_checks(items)
    mine = {x["pattern"]: x for x in items if x.get("script") == SCRIPT}
    if action == "check":
        print("Zone active; no conflicting SEO Worker routes. Existing exact routes:",
              sorted(mine))
        return
    if action == "rollback":
        added = json.loads(STATE.read_text()) if STATE.exists() else []
        for saved in added:
            entry = next((r for r in all_routes(zid) if r.get("id") == saved["id"] and
                          r.get("pattern") == saved["pattern"] and r.get("script") == SCRIPT), None)
            if entry:
                call("DELETE", "zones/" + zid + "/workers/routes/" + entry["id"])
                print("Rolled back route added in this run:", saved["pattern"])
        return
    if action == "verify":
        missing = [x for x in PATTERNS if x not in mine]
        if missing:
            raise RuntimeError("Missing SEO overlay routes: " + repr(missing))
        print("All public SEO and cookie-message exact routes are assigned to isolated Worker.")
        return
    # idempotent apply, writing rollback metadata as each route is created.
    added = []
    persist(added)
    try:
        for pattern in PATTERNS:
            if pattern in mine:
                print("Existing correct route retained:", pattern)
                continue
            result = call("POST", "zones/" + zid + "/workers/routes",
                          {"pattern": pattern, "script": SCRIPT})
            if not isinstance(result, dict) or not result.get("id"):
                raise RuntimeError("Cloudflare route create did not return an ID")
            added.append({"id": result["id"], "pattern": pattern})
            persist(added)
            print("Created exact route:", pattern)
        fresh = all_routes(zid)
        safe_checks(fresh)
        if not all(any(x.get("pattern") == p and x.get("script") == SCRIPT for x in fresh)
                   for p in PATTERNS):
            raise RuntimeError("Route verification did not confirm all patterns")
    except Exception:
        print("Route application failed; rolling back only routes created in this run.")
        for item in reversed(added):
            try:
                call("DELETE", "zones/" + zid + "/workers/routes/" + item["id"])
                print("Restored route:", item["pattern"])
            except Exception as error:
                print("Rollback error:", type(error).__name__, str(error)[:170])
        raise
    print("Published exact public SEO and cookie-message routes; existing Worker untouched.")

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("RELEASE STOP:", type(error).__name__, str(error)[:400])
        sys.exit(1)
