/**
 * Claim webhook work without increasing delivery cadence.
 * New API: one HTTPS request for enqueue + claim.
 * Old API: fall back to original two HTTPS requests, in original order.
 * Ambiguous failures are NOT retried through the fallback to avoid re-claiming.
 */
export async function claimWebhookSafely(store) {
  if(typeof store.claimNextWebhookDeliveryEnqueued==='function'){
    const result=await store.claimNextWebhookDeliveryEnqueued();
    if(result?.supported===true)return result.delivery??null;
    if(result?.supported!==false)throw Error('Invalid combined webhook response');
  }
  await store.enqueueWebhookDeliveries();
  return store.claimNextWebhookDelivery();
}
