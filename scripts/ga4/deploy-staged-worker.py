#!/usr/bin/env python3
"""Deploy verified GA4 Worker version with a strict rollback plan. Never print API credentials."""
import hashlib
import json
import os
import sys
import time
from email.parser import BytesParser
from email.policy import default
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

WORKER = "relaywa-platform"
STAGE = "0fa74406-7b62-430c-820b-5615322d05b6"
PREVIOUS = "65b51e71-2323-4865-b6c7-8b3a43fd677e"
EXPECTED_SHA_PREFIX = "137b53d77f6a7b01"
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
API = ("https://api.cloudflare.com/client/v4/accounts/" +
       quote(ACCOUNT,safe="") + "/workers/scripts/" + WORKER + "/")
EXPECTED_BINDINGS = {
    "DB": "d1",
    "GATE_SECRET": "secret_text",
    "GITHUB_CLIENT_ID": "plain_text",
    "GITHUB_SECRET_CONFIGURED": "plain_text",
    "GOOGLE_CLIENT_ID": "plain_text",
    "JWT_EXPIRES_SECONDS": "plain_text",
    "PLATFORM_JWT_SECRET": "secret_text",
    "STRIPE_CONFIGURED": "plain_text",
    "UPSTREAM_API": "plain_text",
    "UPSTREAM_SITE": "plain_text",
}
deployed = False

def api(path, method="GET", content=None):
    headers={"Authorization": "Bearer "+TOKEN, "Accept": "application/json"}
    if content is not None: headers["Content-Type"]="application/json"
    with urlopen(Request(API+path, data=content,headers=headers,method=method),timeout=22) as response:
        return response.status,response.headers.get("Content-Type",""),response.read(3000000)

def getjson(path):
    status,_,body=api(path)
    if status!=200: raise RuntimeError("Cloudflare GET returned non-200")
    d=json.loads(body)
    if not d.get("success"): raise RuntimeError("Cloudflare GET result unsuccessful")
    return d["result"]

def current():
    result=getjson("deployments")
    dep=result.get("deployments",[])
    if not dep or len(dep[0].get("versions",[]))!=1:
        raise RuntimeError("Concurrent mixed deployment detected")
    if dep[0]["versions"][0].get("percentage") != 100:
        raise RuntimeError("Deployment traffic is not exclusively one version")
    return dep[0]["versions"][0]["version_id"]

def all_binding_types(resources):
    values=resources.get("bindings",{}) if isinstance(resources,dict) else {}
    if isinstance(values,dict): return {k:v["type"] for k,v in values.items()}
    if isinstance(values,list): return {v["name"]:v["type"] for v in values}
    raise RuntimeError("Worker version binding metadata missing")

def public_status(url):
    try:
        with urlopen(Request(url,headers={"Cache-Control":"no-cache","User-Agent":"RelayWA-GA4-PostDeploy-Healthcheck"}),timeout=15) as r:
            return r.status
    except HTTPError as exc:
        return exc.code
    except URLError:
        return None

def deploy_version(version):
    document=json.dumps({
        "strategy":"percentage",
        "versions":[{"percentage":100,"version_id":version}],
        "annotations":{"workers/message":"RelayWA GA4 website-only report integration (PR #122)"}
    }).encode()
    status,_,body=api("deployments",method="POST",content=document)
    data=json.loads(body)
    if status not in (200,201) or not data.get("success"):
        raise RuntimeError("Cloudflare deployment request rejected")

def do():
    global deployed
    print("Guard 1: checking deployed version")
    if current()!=PREVIOUS:
        raise RuntimeError("Production has changed; release aborted without deploying")

    print("Guard 1 passed: deployed version unchanged")
    stage=getjson("versions/"+STAGE)
    new_types=all_binding_types(stage.get("resources"))
    if new_types!={**EXPECTED_BINDINGS,"GA4_SERVICE_ACCOUNT_JSON":"secret_text"}:
        raise RuntimeError("Staged version's inherited or GA4 bindings are not exactly as expected")

    print("Guard 2 passed: staged bindings match")
    older=getjson("versions/"+PREVIOUS)
    original_types=all_binding_types(older.get("resources"))
    if original_types!=EXPECTED_BINDINGS:
        raise RuntimeError("Rollback version does not match expected original bindings")

    print("Guard 3 passed: rollback version bindings match")
    status,kind,data=api("")
    if status!=200 or not kind.startswith("multipart/"):
        raise RuntimeError("Unable to verify current Worker code")
    message=BytesParser(policy=default).parsebytes(
        b"Content-Type: "+kind.encode()+b"\r\nMIME-Version: 1.0\r\n\r\n"+data)
    entry=[p.get_payload(decode=True) for p in message.iter_parts()
           if (p.get_filename() or p.get_param("name",header="content-disposition"))=="index.js"]
    if len(entry)!=1 or not hashlib.sha256(entry[0]).hexdigest().startswith(EXPECTED_SHA_PREFIX):
        raise RuntimeError("Worker source changed since staging; release aborted")

    print("Guard 4 passed: original platform script hash unchanged")
    protected="https://platform.relaywa.com/api/platform/google-analytics?days=7"
    whoami="https://platform.relaywa.com/api/platform/whoami"
    baseline=public_status(protected)
    baseline_whoami=public_status(whoami)
    print("Pre-deploy GA4 unauthorized route status:",baseline)
    print("Pre-deploy whoami unauthorized route status:",baseline_whoami)
    if baseline not in (401,403) or baseline_whoami not in (401,403):
        raise RuntimeError("Unexpected authentication baseline; manual review required")

    print("Staged secret and original 10 bindings verified; release guard passed.")
    print("Deploying only:",WORKER,"version:",STAGE)
    deploy_version(STAGE)
    deployed=True
    for _ in range(8):
        if current()==STAGE: break
        time.sleep(1)
    if current()!=STAGE: raise RuntimeError("Deployed version not active")
    print("Cloudflare reports stage version active.")

    for index in range(3):
        ga4=public_status(protected)
        admin=public_status(whoami)
        platform=public_status("https://platform.relaywa.com/")
        print("Post-deploy check",index+1,": unauthorized GA4",ga4,
              "unauthorized whoami",admin,"platform root",platform)
        if ga4 not in (401,403) or admin not in (401,403) or \
           platform not in (200,301,302,303,307,308):
            raise RuntimeError("Public platform health or auth guards differ after rollout")
        time.sleep(1)

    if current()!=STAGE:raise RuntimeError("Production Worker changed during verification")
    print("SUCCESS: RelayWA GA4 website-only Worker is live; original auth and service checks passed.")
    print("The authenticated platform-admin GA4 report still requires a browser login verification.")
    print("Rollback version:",PREVIOUS)

if __name__=="__main__":
    try:
        do()
    except Exception as error:
        print("Release stopped; category:",type(error).__name__)
        if deployed:
            print("Attempting automatic rollback to the verified original Worker version.")
            try:
                deploy_version(PREVIOUS)
                if current()==PREVIOUS:print("ROLLBACK COMPLETED; original Worker restored.")
                else:print("ROLLBACK NOT CONFIRMED — urgent Cloudflare admin review required.")
            except Exception:
                print("ROLLBACK REQUEST FAILED — urgent Cloudflare admin review required.")
        else:
            print("No new live deployment was submitted.")
        sys.exit(1)
