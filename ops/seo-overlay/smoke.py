"""Validate staged or live SEO routes without credentials or message/API actions."""
import json
import os
import sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import re
import time
from html import unescape

PATHS = [
  "/whatsapp-api-qr-code",
  "/whatsapp-webhooks",
  "/guides/whatsapp-web-vs-cloud-api"
]
PREVIEW = len(sys.argv) == 2 and sys.argv[1] == "preview"
LIVE = len(sys.argv) == 2 and sys.argv[1] == "live"
if not (PREVIEW or LIVE):
    raise SystemExit("Usage: smoke.py preview|live")

def cfapi(path):
    req = Request("https://api.cloudflare.com/client/v4/" + path,
                  headers={"Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"]})
    with urlopen(req, timeout=20) as response:
        doc = json.load(response)
    if not doc.get("success"):
        raise RuntimeError("Cloudflare account subdomain lookup failed")
    return doc["result"]

if PREVIEW:
    info = cfapi("accounts/" + os.environ["CLOUDFLARE_ACCOUNT_ID"] + "/workers/subdomain")
    subdomain = info.get("subdomain", "")
    if not subdomain or not re.fullmatch(r"[A-Za-z0-9-]+", subdomain):
        raise RuntimeError("Cannot verify stage Worker: account workers.dev subdomain unavailable")
    origin = "https://" + os.environ.get("SEO_PREVIEW_WORKER", "relaywa-seo-pages") + "." + subdomain + ".workers.dev"
else:
    origin = "https://relaywa.com"

def get(path):
    req = Request(origin + path, headers={
        "User-Agent": "RelayWA-SEO-GitHub-Release-Verification/1.0",
        "Accept": "text/html,application/xml,text/plain"
    })
    for attempt in range(12):
        try:
            with urlopen(req, timeout=25) as res:
                return res.status, {k.lower(): v for k, v in res.headers.items()}, res.read(1_500_000).decode("utf-8", "replace")
        except HTTPError as error:
            if error.code not in (404, 429, 500, 502, 503) or attempt == 11:
                raise
            print(f"Retrying transient edge HTTP {error.code} for {path}: {attempt+1}/12")
            time.sleep(2)

for path in PATHS:
    status, headers, html = get(path)
    assert status == 200, f"{path} HTTP {status}"
    assert headers.get("x-relaywa-seo-overlay") == "1", f"{path} did not hit the isolated Worker"
    assert headers.get("content-type", "").startswith("text/html"), path
    assert 'href="https://relaywa.com' + path + '"' in html, f"{path} canonical missing"
    assert re.search(r"<h1(?:\s|>)", html), f"{path} heading missing"
    assert len(re.findall(r"<h1(?:\s|>)", html)) == 1, f"{path} duplicate headings"
    assert "<style" in html, f"{path} missing CSS"
    assert "application/ld+json" in html, f"{path} schema missing"
    assert "noindex" not in html.lower(), f"{path} incorrectly nonindexable"
    assert "self.__next_f" not in html, f"{path} hydration code retained"
    assert 'src="/relaywa-cookie-message.js"' in html, "Cookie message script missing: " + path
    assert 'href="/relaywa-cookie-message.css"' in html, "Cookie notice styles missing: " + path
    print("SEO page and cookie notice verified:", origin + path)

# Both resources must be served by the SEO overlay and never redirect to auth.
for resource, expected in (
    ("/relaywa-cookie-message.js", "We use cookies"),
    ("/relaywa-cookie-message.css", ".rw-cookie-message"),
):
    _, headers, payload = get(resource)
    assert headers.get("x-relaywa-cookie-assets") == "1", "Asset is not served by this Worker"
    assert expected in payload, "Cookie asset incomplete: " + resource
    print("Cookie message asset available:", origin + resource)

# Existing marketing pages must retain their origin HTML.
for path in (
    "/", "/pricing", "/api-docs", "/help", "/blog",
    "/blog/nodejs-whatsapp-api-send-webhooks",
    "/blog/laravel-whatsapp-api-order-notifications",
    "/blog/whatsapp-api-qr-session-troubleshooting",
):
    status, headers, html = get(path)
    assert status == 200, "Marketing page not reachable: " + path
    assert headers.get("x-relaywa-cookie-message") == "1", "Cookie overlay missing: " + path
    if PREVIEW:
        assert "noindex" in headers.get("x-robots-tag", ""), "Preview origin must not be indexed: " + path
    assert "relaywa-cookie-message.js" in html, "Cookie loader missing: " + path
    assert "relaywa-cookie-message.css" in html, "Cookie stylesheet missing: " + path
    assert "RelayWA" in html, "Original page content missing: " + path
    print("Original marketing page and cookie notice verified:", origin + path)

if LIVE:
    _, headers, sitemap = get("/sitemap.xml")
    assert headers.get("x-relaywa-seo-overlay") == "1", "Sitemap overlay not executing"
    assert sitemap.count("<loc>") >= 11, "Published sitemap lost original content"
    for p in PATHS:
        assert sitemap.count("<loc>https://relaywa.com" + p + "</loc>") == 1, "Sitemap missing/duplicate: " + p
    for existing in ("/", "/pricing", "/api-docs", "/help", "/blog"):
        assert "https://relaywa.com" + existing in sitemap, "Previous sitemap entry removed: " + existing
    assert "/login</loc>" not in sitemap and "/dashboard</loc>" not in sitemap
    _, headers, home = get("/")
    assert headers.get("x-relaywa-seo-overlay") is None, "Homepage replaced by SEO snapshot"
    assert headers.get("x-relaywa-cookie-message") == "1", "Cookie notice not applied to original homepage"
    assert "WhatsApp API for Developers" in home, "Homepage changed"
    _, headers, robots = get("/robots.txt")
    assert headers.get("x-relaywa-seo-overlay") is None, "Robots unexpectedly intercepted"
    assert "Sitemap: https://relaywa.com/sitemap.xml" in robots, "Original robots lost"
    print("Live sitemap and unchanged homepage/robots verified.")
else:
    print("Isolated Workers.dev preview verified; production routes unchanged.")
