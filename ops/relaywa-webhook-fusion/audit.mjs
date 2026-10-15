// Read-only production compatibility audit. No credentials or user data are logged.
const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare access');
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
const headers={authorization:'Bearer '+token};
const r=await fetch(root+'/workers/scripts/relaywa-api',{headers,signal:AbortSignal.timeout(25000)});
if(!r.ok)throw Error('Cannot inspect live API: HTTP '+r.status);
const form=await r.formData();
const entry=form.get('index.js');
if(!entry)throw Error('Missing API entry module');
const source=typeof entry==='string'?entry:await entry.text();
for(const needle of ['f.post("/webhooks/enqueue"','f.post("/webhooks/claim"','f.post("/messages/poll"','f.post("/commands/claim"','I.route("/internal/worker", f);']){
 const start=source.indexOf(needle);
 if(start<0)throw Error('Required bridge handler absent: '+needle);
 const next=source.indexOf('\nf.post(',start+needle.length);
 const snippet=source.slice(start,Math.min(source.length,start+3800,next>start?next:start+3800));
 console.log('REVIEWED_HANDLER '+needle+' '+JSON.stringify(snippet));
}
const apiRoot=root+'/workers/scripts/relaywa-api';
const dep=await fetch(apiRoot+'/deployments',{headers,signal:AbortSignal.timeout(15000)});
if(!dep.ok)throw Error('Cannot list active deployment');
const json=await dep.json();
const versions=json.result?.deployments?.[0]?.versions;
console.log('ACTIVE_API_VERSION '+JSON.stringify(versions?.map(x=>({id:x.version_id,percentage:x.percentage}))));
