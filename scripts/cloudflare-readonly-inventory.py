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

# Inspect current code shape and binding *names*, not secret values.
for worker_name in ("relaywa-web", "relaywa-api", "relaywa-platform"):
    settings = fetch(f"accounts/{ACCOUNT}/workers/scripts/{worker_name}/settings", f"{worker_name} settings")
    if isinstance(settings, dict):
        bindings = settings.get("bindings") or []
        print(f"  {worker_name} binding types:", ", ".join(sorted(set(identifier(b.get("type")) for b in bindings))))
        print(f"  {worker_name} binding names:", ", ".join(identifier(b.get("name")) for b in bindings))
    deployments = fetch(f"accounts/{ACCOUNT}/workers/scripts/{worker_name}/deployments", f"{worker_name} deployments")
    if isinstance(deployments, dict):
        items = deployments.get("deployments") or []
    elif isinstance(deployments, list):
        items = deployments
    else:
        items = []
    for entry in items[:2]:
        print(f"  {worker_name} deployment:", identifier(entry.get("id")),
              "| created:", identifier(entry.get("created_on")),
              "| active:", bool(entry.get("versions")))
    # Downloaded script content is inspected IN MEMORY only; never printed or stored.
    request = Request(f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{worker_name}",
                      headers={"Authorization": "Bearer " + TOKEN}, method="GET")
    try:
        with urlopen(request, timeout=25) as res:
            source = res.read(2_500_000).decode("utf-8", "replace")
            kind = res.headers.get("content-type", "").split(";", 1)[0]
        print(f"  {worker_name} script:", len(source), "bytes | MIME:", identifier(kind),
              "| proxy-style:", any(s in source for s in ("fetch(request", "fetch(req", "upstream", "ORIGIN")),
              "| Next/OpenNext:", any(s in source for s in ("open-next", "next/dist", "NextResponse", "vinext")))
    except HTTPError as e:
        print(f"  {worker_name} script read: HTTP {e.code}")
    except (URLError, TimeoutError, ValueError):
        print(f"  {worker_name} script read: unavailable")

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
# Probe the actual live edge from GitHub's independent network.
# No authentication, no POST and no bot-identity spoofing.
for path in ("/", "/robots.txt", "/sitemap.xml", "/whatsapp-api-qr-code",
             "/whatsapp-webhooks", "/guides/whatsapp-web-vs-cloud-api"):
    req = Request("https://relaywa.com" + path,
                  headers={"User-Agent": "RelayWA-SEO-GitHub-ReadOnly/1.0", "Accept": "text/html,application/xml,text/plain"},
                  method="GET")
    try:
        with urlopen(req, timeout=18) as res:
            status, headers = res.status, res.headers
            res.read(1000)
    except HTTPError as e:
        status, headers = e.code, e.headers
        error_html = e.read(4096).decode("utf-8", "replace")
    except (URLError, TimeoutError):
        print("  edge GET", path, "network unavailable")
        continue
    print("  edge GET", path, "HTTP", status,
          "| server:", identifier(headers.get("server")),
          "| cf-ray present:", bool(headers.get("cf-ray")),
          "| cf-mitigated:", identifier(headers.get("cf-mitigated")),
          "| retry-after:", identifier(headers.get("retry-after")),
          "| content-type:", identifier(headers.get("content-type")))
    if status == 429:
        import re
        match = re.search(r"<title[^>]*>([^<]{0,180})", error_html, flags=re.I)
        print("    429 title:", identifier(match.group(1) if match else "none"),
              "| Cloudflare error 1015:", "1015" in error_html,
              "| Worker custom error:", any(x in error_html.lower() for x in ("too many requests", "rate limit", "quota exceeded")),
              "| cf-error-code:", identifier(headers.get("cf-error-code")))

# One browser-header GET for comparison, without pretending to be a verified search crawler.
try:
    req = Request("https://relaywa.com/robots.txt", method="GET", headers={
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36"
    })
    with urlopen(req, timeout=18) as res:
        print("  browser-header GET /robots.txt: HTTP", res.status)
except HTTPError as e:
    print("  browser-header GET /robots.txt: HTTP", e.code)
except (URLError, TimeoutError):
    print("  browser-header GET /robots.txt: unavailable")

print("Cloudflare read-only inventory complete; no changes or deployments.")
if not found:
    print("ERROR: relaywa.com zone not visible to provided API credentials")
    sys.exit(1)
