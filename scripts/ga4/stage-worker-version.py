#!/usr/bin/env python3
"""Stage (do not deploy) RelayWA GA4 Worker version. Never prints secret values."""
import base64
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import uuid
from email.parser import BytesParser
from email.policy import default
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

TARGET = "relaywa-platform"
PREFIX = "https://api.cloudflare.com/client/v4/accounts/"
account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
token = os.environ["CLOUDFLARE_API_TOKEN"]
credentials = os.environ["GA4_SERVICE_ACCOUNT_JSON"]
root = PREFIX + quote(account, safe="") + "/workers/"
headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}

def call(path, method="GET", data=None, content_type=None):
    h = dict(headers)
    if content_type: h["Content-Type"] = content_type
    try:
        with urlopen(Request(root + path, data=data, headers=h, method=method), timeout=30) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read(8_000_000)
    except HTTPError as error:
        # No response bodies: APIs may include submitted secret data.
        print("Cloudflare API", method, "HTTP", error.code)
        raise RuntimeError("Cloudflare API request failed") from None

def getjson(path):
    status, _, body = call(path)
    value = json.loads(body)
    if not value.get("success"): raise RuntimeError("Cloudflare read failed")
    return value["result"]

def encode_multipart(metadata, modules):
    boundary = "----RelaywaGA4" + uuid.uuid4().hex
    parts = []
    def part(name, data, kind, filename=None):
        disp = 'Content-Disposition: form-data; name="' + name + '"'
        if filename: disp += '; filename="' + filename + '"'
        parts.extend([
            ("--" + boundary + "\r\n").encode(),
            (disp + "\r\nContent-Type: " + kind + "\r\n\r\n").encode(),
            data,
            b"\r\n",
        ])
    part("metadata", json.dumps(metadata, separators=(",", ":")).encode(), "application/json")
    for name, data in modules.items():
        part(name, data, "application/javascript+module", name)
    parts.append(("--" + boundary + "--\r\n").encode())
    return b"".join(parts), "multipart/form-data; boundary=" + boundary

def main():
    cred = json.loads(credentials)
    if not (cred.get("type") == "service_account" and
            cred.get("client_email") == "relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com" and
            "BEGIN PRIVATE KEY" in cred.get("private_key", "")):
        raise RuntimeError("Invalid GA4 JSON secret identity")

    domains = getjson("domains")
    if not any(x.get("hostname") == "platform.relaywa.com" and
               x.get("service") == TARGET and x.get("environment") == "production"
               for x in domains):
        raise RuntimeError("Worker target hostname verification failed")

    deployments = getjson("scripts/" + TARGET + "/deployments")
    found = deployments.get("deployments", [])
    if not found or len(found[0].get("versions", [])) != 1 or \
       found[0]["versions"][0].get("percentage") != 100:
        raise RuntimeError("Unexpected deployment state; stage aborted")
    deployed = found[0]["versions"][0]["version_id"]
    if not isinstance(deployed, str) or len(deployed) < 32:
        raise RuntimeError("Unable to identify deployed version")

    versions = getjson("scripts/" + TARGET + "/versions")
    # The API may return list or a paginated items object.
    items = versions if isinstance(versions, list) else versions.get("items", versions.get("versions", []))
    if not items or items[0].get("id") != deployed:
        raise RuntimeError("Latest Worker version differs from currently deployed version; manual synchronization needed")

    settings = getjson("scripts/" + TARGET + "/settings")
    existing = settings.get("bindings", [])
    expected = {"DB": "d1", "GATE_SECRET": "secret_text", "GITHUB_CLIENT_ID": "plain_text",
                "GITHUB_SECRET_CONFIGURED": "plain_text", "GOOGLE_CLIENT_ID": "plain_text",
                "JWT_EXPIRES_SECONDS": "plain_text", "PLATFORM_JWT_SECRET": "secret_text",
                "STRIPE_CONFIGURED": "plain_text", "UPSTREAM_API": "plain_text",
                "UPSTREAM_SITE": "plain_text"}
    actual = {b.get("name"): b.get("type") for b in existing}
    if actual != expected:
        raise RuntimeError("Unexpected Worker bindings; refusing staging")
    if not settings.get("compatibility_date"):
        raise RuntimeError("Missing Worker compatibility date")

    status, content_type, raw = call("scripts/" + TARGET)
    if status != 200 or not content_type.lower().startswith("multipart/"):
        raise RuntimeError("Expected multipart Worker source")
    email = BytesParser(policy=default).parsebytes(
        b"Content-Type: " + content_type.encode() + b"\r\nMIME-Version: 1.0\r\n\r\n" + raw)
    modules = {}
    for item in email.iter_parts():
        name = item.get_filename() or item.get_param("name", header="content-disposition")
        if not name or name in modules or any(c in name for c in ("/", "\\", "\x00")):
            raise RuntimeError("Unexpected module name")
        modules[name] = item.get_payload(decode=True) or b""
    required = {"index.js", "platform-mfa.mjs", "recovery-routes.mjs",
                "enterprise-admin.mjs", "enterprise-api.mjs",
                "enterprise-core.mjs", "enterprise-pages.mjs"}
    if set(modules) != required:
        raise RuntimeError("Worker module inventory mismatch; abort")

    temp = pathlib.Path(os.environ.get("RUNNER_TEMP") or tempfile.gettempdir())
    before = temp / "relaywa-ga4-platform-before.mjs"
    after = temp / "relaywa-ga4-platform-candidate.mjs"
    backup = temp / "relaywa-ga4-platform-before.multipart"
    before.write_bytes(modules["index.js"])
    os.chmod(before, 0o600)
    backup.write_bytes(raw)
    os.chmod(backup, 0o600)
    subprocess.run(["node", "scripts/ga4/patch-platform-worker.mjs",
                    str(before), "cloudflare/ga4-reporting.mjs", str(after)],
                   check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["node", "--check", str(after)], check=True)
    patched = after.read_bytes()
    if not patched.startswith(modules["index.js"].split(b"async function googleAnalytics(env, url)")[0]):
        raise RuntimeError("Patched entrypoint prefix mismatch")
    if patched.count(b"GA4_SERVICE_ACCOUNT_JSON") < 1:
        raise RuntimeError("Secret binding not referenced by patch")
    original_hash = hashlib.sha256(modules["index.js"]).hexdigest()
    modules["index.js"] = patched
    print("Live platform source copied securely; entrypoint-only patch syntax passed.")
    print("Non-GA4 modules retained:", len(modules) - 1)
    print("Original code SHA-256 prefix:", original_hash[:16])
    print("Rollback Worker version:", deployed)

    metadata = {
        "main_module": "index.js",
        "compatibility_date": settings["compatibility_date"][:10],
        "compatibility_flags": settings.get("compatibility_flags") or [],
        "bindings": ([{"type": "inherit", "name": b["name"]} for b in existing] +
                     [{"type": "secret_text", "name": "GA4_SERVICE_ACCOUNT_JSON", "text": credentials}]),
        "annotations": {"workers/message": "RelayWA GA4 web browser reporting staging (PR #122)"}
    }
    body, mime = encode_multipart(metadata, modules)

    # Stage a new immutable version. This DOES NOT deploy or affect production traffic.
    status, _, response = call("scripts/" + TARGET + "/versions?bindings_inherit=strict",
                                "POST", body, mime)
    parsed = json.loads(response)
    if status not in (200, 201) or not parsed.get("success"):
        raise RuntimeError("Cloudflare stage version rejected")
    result = parsed.get("result") or {}
    version = result.get("id")
    if not version:
        raise RuntimeError("Staging version ID was not returned")
    print("Candidate Worker version staged (not deployed):", version)
    print("Existing deployed version remains:", deployed)

    deployed_after = getjson("scripts/" + TARGET + "/deployments")["deployments"][0]["versions"]
    if len(deployed_after) != 1 or deployed_after[0].get("version_id") != deployed:
        raise RuntimeError("Production deployment changed concurrently, manual review required")

    manifest = {"worker": TARGET, "version_id": version, "previous_version_id": deployed,
                "original_entrypoint_sha256": original_hash,
                "module_names": sorted(modules), "repo_commit": os.environ.get("GITHUB_SHA")}
    destination = temp / "relaywa-ga4-stage-manifest.json"
    destination.write_text(json.dumps(manifest, indent=2))
    print("Staged version verified not serving traffic. Manifest ready (contains no secrets).")

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Fixed text only. Never log raw exception or API body with potentially sensitive data.
        print("GA4 staging halted. No live deployment was attempted.")
        print("Failure category:", type(error).__name__)
        sys.exit(1)
