import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
type Input=Record<string,unknown>;
@Controller('internal/worker')
export class WorkerWebhooksController {
 constructor(private readonly db:DatabaseService){}
 private auth(header:string|undefined,b:Input):string {
  const secret=process.env.WORKER_DISPATCH_SECRET;
  if(!secret||!header?.startsWith('Bearer '))throw new ForbiddenException();
  const a=Buffer.from(header.slice(7)),s=Buffer.from(secret);
  if(a.length!==s.length||!timingSafeEqual(a,s)||typeof b.workerId!=='string'||!/^[a-zA-Z0-9._:-]{1,120}$/.test(b.workerId))throw new ForbiddenException();return b.workerId;
 }
 private uuid(v:unknown):string{if(typeof v!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(v))throw new ForbiddenException();return v;}
 @Post('webhooks/enqueue') @HttpCode(200)
 async enqueue(@Headers('authorization') h:string|undefined,@Body() b:Input){
  this.auth(h,b);const limit=Number(b.limit??100);
  if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new ForbiddenException();
  const r=await this.db.query(`WITH candidates AS (SELECT e.id AS session_event_id,e.organization_id,w.id AS endpoint_id FROM whatsapp_session_events e JOIN organizations o ON o.id=e.organization_id AND o.suspended_at IS NULL JOIN webhook_endpoints w ON w.organization_id=e.organization_id AND w.enabled=true AND e.created_at>=w.created_at AND ('*'=ANY(w.event_types) OR e.event_type=ANY(w.event_types)) LEFT JOIN webhook_deliveries d ON d.endpoint_id=w.id AND d.session_event_id=e.id WHERE d.id IS NULL ORDER BY e.id ASC LIMIT $1) INSERT INTO webhook_deliveries(id,endpoint_id,organization_id,session_event_id,status) SELECT gen_random_uuid(),endpoint_id,organization_id,session_event_id,'queued' FROM candidates ON CONFLICT(endpoint_id,session_event_id) DO NOTHING RETURNING id`,[limit]);return {enqueued:r.rowCount??0};
 }
 @Post('webhooks/claim') @HttpCode(200)
 async claim(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=this.auth(h,b);
  const delivery=await this.db.transaction(async client=>{
   const result=await client.query(`SELECT d.id,d.endpoint_id,d.organization_id,d.session_event_id,d.attempts,w.url,w.secret_encrypted,e.session_id,e.event_type,e.payload,e.created_at AS event_created_at FROM webhook_deliveries d JOIN organizations o ON o.id=d.organization_id AND o.suspended_at IS NULL JOIN webhook_endpoints w ON w.id=d.endpoint_id AND w.enabled=true JOIN whatsapp_session_events e ON e.id=d.session_event_id WHERE d.status='queued' AND d.next_attempt_at<=now() ORDER BY d.next_attempt_at ASC,d.queued_at ASC FOR UPDATE OF d SKIP LOCKED LIMIT 1`);
   const item=result.rows[0];if(!item)return null;
   await client.query(`UPDATE webhook_deliveries SET status='claimed',worker_id=$1,claimed_at=now(),attempts=attempts+1,updated_at=now() WHERE id=$2`,[worker,item.id]);
   return {...item,attempts:Number(item.attempts)+1};
  });return {delivery};
 }
 @Post('webhooks/claim-enqueued') @HttpCode(200)
 async claimEnqueued(@Headers('authorization') h:string|undefined,@Body() b:Input){return this.claim(h,b);}
 @Post('webhooks/delivered') @HttpCode(200)
 async delivered(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=this.auth(h,b),id=this.uuid(b.deliveryId),status=Number(b.statusCode);
  if(!Number.isSafeInteger(status)||status<100||status>599)throw new ForbiddenException();
  const updated=await this.db.transaction(async client=>{
   const result=await client.query(`UPDATE webhook_deliveries SET status='delivered',response_status=$3,response_body=$4,last_error=NULL,delivered_at=now(),updated_at=now() WHERE id=$1 AND worker_id=$2 AND status='claimed' RETURNING endpoint_id`,[id,worker,status,typeof b.responseBody==='string'?b.responseBody.slice(0,4000):null]);
   if(result.rows[0])await client.query(`UPDATE webhook_endpoints SET consecutive_failures=0,last_success_at=now(),updated_at=now() WHERE id=$1`,[result.rows[0].endpoint_id]);return result.rowCount===1;
  });return {ok:true,updated};
 }
 @Post('webhooks/reschedule') @HttpCode(200)
 async reschedule(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=this.auth(h,b);
  if(!b.delivery||typeof b.delivery!=='object'||Array.isArray(b.delivery))throw new ForbiddenException();
  const delivery=b.delivery as Record<string,unknown>,id=this.uuid(delivery.id);
  const attempts=Number(delivery.attempts),max=Number(process.env.WEBHOOK_MAX_ATTEMPTS??6);
  if(!Number.isSafeInteger(attempts)||attempts<1||attempts>10000||!Number.isSafeInteger(max)||max<1)throw new ForbiddenException();
  const delays=[5,30,120,600,1800,3600],exhausted=attempts>=max,delay=delays[Math.min(attempts-1,delays.length-1)];
  const error=b.error&&typeof b.error==='object'&&!Array.isArray(b.error)?b.error as Record<string,unknown>:{};
  const code=error.statusCode==null?null:Number(error.statusCode);
  if(code!==null&&(!Number.isSafeInteger(code)||code<100||code>599))throw new ForbiddenException();
  const updated=await this.db.transaction(async client=>{
   const r=await client.query(`UPDATE webhook_deliveries SET status=$3::varchar,next_attempt_at=CASE WHEN $3::varchar='queued' THEN now()+($4::int*interval '1 second') ELSE next_attempt_at END,response_status=$5,response_body=$6,last_error=$7,failed_at=CASE WHEN $3::varchar='failed' THEN now() ELSE NULL END,worker_id=CASE WHEN $3::varchar='queued' THEN NULL ELSE worker_id END,claimed_at=CASE WHEN $3::varchar='queued' THEN NULL ELSE claimed_at END,updated_at=now() WHERE id=$1 AND worker_id=$2 AND status='claimed' AND attempts=$8 RETURNING endpoint_id`,[id,worker,exhausted?'failed':'queued',delay,code,typeof error.responseBody==='string'?error.responseBody.slice(0,4000):null,typeof error.message==='string'?error.message.slice(0,2000):'Webhook failed',attempts]);
   if(r.rows[0])await client.query(`UPDATE webhook_endpoints SET consecutive_failures=consecutive_failures+1,last_failure_at=now(),updated_at=now() WHERE id=$1`,[r.rows[0].endpoint_id]);return r.rowCount===1;
  });return {ok:true,updated};
 }
}
