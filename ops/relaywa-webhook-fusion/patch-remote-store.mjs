// Targeted addition to the VPS RemoteStore (no session/auth changes).
export function patchRemoteStoreWebhook(original){
  const src=String(original);
  const anchor='  async claimNextWebhookDelivery() {';
  if(src.split(anchor).length!==2||src.includes('claimNextWebhookDeliveryEnqueued()'))
    throw Error('RemoteStore changed or fusion already installed');
  const method=`  async claimNextWebhookDeliveryEnqueued() {
    try {
      const result=await this.call('/webhooks/claim-enqueued', {}, {retries:1});
      return {supported:true,delivery:parseJsonFields(result.delivery??null,['payload'])};
    } catch(error) {
      // 404/405/501 mean only that the new route is absent/unsupported.
      // Do not fallback on network failures or 5xx: a job might be claimed.
      if([404,405,501].includes(error?.statusCode))return {supported:false,delivery:null};
      throw error;
    }
  }

`;
  return src.replace(anchor,method+anchor);
}
