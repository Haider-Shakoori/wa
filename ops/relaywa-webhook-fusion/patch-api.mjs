/**
 * Add a dedicated, protected webhook enqueue+claim endpoint to the deployed
 * Cloudflare relaywa-api. Delegates to the ORIGINAL worker handlers in order;
 * leaves existing endpoints intact for older clients and rollback.
 */
export function patchWebhookFusionApi(original) {
  const source=String(original);
  const insertion='I.route("/internal/worker", f);';
  for(const anchor of [insertion,'f.post("/webhooks/enqueue"','f.post("/webhooks/claim"']){
    if(source.split(anchor).length!==2)throw Error('Unexpected Cloudflare bundle: '+anchor);
  }
  if(source.includes('RELAYWA_WEBHOOK_FUSION_V1'))throw Error('Webhook fusion already present');
  const route=`
/* RELAYWA_WEBHOOK_FUSION_V1 */
f.post("/webhooks/claim-enqueued",async(e)=>{
  const payload=await e.req.json();
  const workerId=A(payload);
  const internalHeaders={
    authorization:e.req.header("authorization")||"",
    "content-type":"application/json"
  };
  const internal=async(path,body)=>{
    const url=new URL(e.req.url);
    url.pathname=path;
    url.search="";
    return f.fetch(new Request(url.toString(),{
      method:"POST",headers:internalHeaders,
      body:JSON.stringify({workerId,...body})
    }),e.env,e.executionCtx);
  };
  const enqueued=await internal("/webhooks/enqueue",{limit:100});
  if(!enqueued.ok)return enqueued;
  const claimed=await internal("/webhooks/claim",{});
  if(!claimed.ok)return claimed;
  const body=await claimed.json();
  e.header("X-RelayWA-Webhook-Combined","1");
  return e.json(body);
});
`;
  return source.replace(insertion,route+'\n'+insertion);
}
