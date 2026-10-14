"""Validate staged or live SEO routes without credentials or message/API actions."""
import json
import os
import sys
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import re
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
    origin = "https://relaywa-seo-pages." + subdomain + ".workers.dev"
else:
    origin = "https://relaywa.com"

def get(path):
    req = Request(origin + path, headers={
        "User-Agent": "RelayWA-SEO-GitHub-Release-Verification/1.0",
        "Accept": "text/html,application/xml,text/plain"
    })
    with urlopen(req, timeout=25) as res:
        return res.status, dict(res.headers), res.read(1_500_000).decode("utf-8", "replace")

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
    print("SEO page verified:", origin + path)

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
    assert headers.get("x-relaywa-seo-overlay") is None, "Homepage unexpectedly intercepted"
    assert "WhatsApp API for Developers" in home, "Homepage changed"
    _, headers, robots = get("/robots.txt")
    assert headers.get("x-relaywa-seo-overlay") is None, "Robots unexpectedly intercepted"
    assert "Sitemap: https://relaywa.com/sitemap.xml" in robots, "Original robots lost"
    print("Live sitemap and unchanged homepage/robots verified.")
else:
    print("Isolated Workers.dev preview verified; production routes unchanged.")
