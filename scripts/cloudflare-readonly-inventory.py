"""Read-only Cloudflare inventory for GitHub Actions. Never output API credentials."""
import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

TOKEN = os.getenv("CF_API_TOKEN", "")
ACCOUNT = os.getenv("CF_ACCOUNT_ID", "")

def fetch(path, label):
    req = Request("https://api.cloudflare.com/client/v4/" + path,
                  headers={"Authorization": "Bearer " + TOKEN, "Accept": "application/json"},
                  method="GET")
    try:
        with urlopen(req, timeout=20) as response:
            data = json.load(response)
        if not data.get("success"):
            print(f"{label}: API response not successful")
            return None
        return data.get("result")
    except HTTPError as e:
        print(f"{label}: HTTP {e.code} (permission or feature availability)")
    except (URLError, TimeoutError, ValueError) as e:
        print(f"{label}: request failed ({type(e).__name__})")
    return None

def identifier(s):
    return str(s or "").replace("\n", " ").replace("\r", " ")[:130]

if not TOKEN or not ACCOUNT:
    print("ERROR: Cloudflare token/account ID unavailable in workflow secret environment.")
    sys.exit(1)
auth = fetch("user/tokens/verify", "token verification")
if not isinstance(auth, dict) or auth.get("status") != "active":
    print("ERROR: Cloudflare API token was not verified as active.")
    sys.exit(1)
print("Cloudflare auth: active")

workers = fetch(f"accounts/{ACCOUNT}/workers/scripts?per_page=100", "Workers scripts")
if isinstance(workers, list):
    print("Worker scripts count:", len(workers))
    for w in workers:
        name = identifier(w.get("id") or w.get("name"))
        print("  worker:", name, "| modified:", identifier(w.get("modified_on")))

domains = fetch(f"accounts/{ACCOUNT}/workers/domains", "Workers custom domains")
if isinstance(domains, list):
    print("Worker custom domains count:", len(domains))
    for d in domains:
        print("  worker_domain:", identifier(d.get("hostname")),
              "| service:", identifier(d.get("service")), "| environment:", identifier(d.get("environment")))

pages = fetch(f"accounts/{ACCOUNT}/pages/projects?per_page=100", "Pages projects")
if isinstance(pages, list):
    print("Pages projects count:", len(pages))
    for p in pages:
        print("  pages:", identifier(p.get("name")),
              "| production branch:", identifier(p.get("production_branch")),
              "| domains:", ", ".join(identifier(x) for x in (p.get("domains") or [])[:12]))
        latest = p.get("latest_deployment") or {}
        if latest:
            print("    latest deployment:", identifier(latest.get("id")), "| stage:", identifier((latest.get("latest_stage") or {}).get("name")),
                  "| status:", identifier((latest.get("latest_stage") or {}).get("status")),
                  "| commit:", identifier((latest.get("deployment_trigger") or {}).get("metadata", {}).get("commit_hash")))

zones = fetch("zones?name=relaywa.com&per_page=50", "relaywa.com zone")
found = False
if isinstance(zones, list):
    print("relaywa.com zones matched:", len([z for z in zones if z.get("name") == "relaywa.com"]))
    for z in zones:
        if z.get("name") != "relaywa.com":
            continue
        found = True
        zid = z["id"]
        print("  zone status:", identifier(z.get("status")), "| plan:", identifier((z.get("plan") or {}).get("name")))
        routes = fetch(f"zones/{zid}/workers/routes?per_page=100", "Worker zone routes")
        if isinstance(routes, list):
            for route in routes:
                print("  zone_route:", identifier(route.get("pattern")), "| script:", identifier(route.get("script")))
        rulesets = fetch(f"zones/{zid}/rulesets?per_page=100", "Zone rulesets")
        if isinstance(rulesets, list):
            print("  rulesets count:", len(rulesets))
            for item in rulesets:
                print("    ruleset:", identifier(item.get("name")), "| kind:", identifier(item.get("kind")), "| phase:", identifier(item.get("phase")))
        rate = fetch(f"zones/{zid}/rate_limits?per_page=100", "Legacy rate limits")
        if isinstance(rate, list):
            print("  legacy rate-limit count:", len(rate))
            for item in rate:
                print("    rate-limit:", identifier(item.get("description")), "| disabled:", bool(item.get("disabled", False)))
print("Cloudflare read-only inventory complete; no changes or deployments.")
if not found:
    print("ERROR: relaywa.com zone not visible to provided API credentials")
    sys.exit(1)
