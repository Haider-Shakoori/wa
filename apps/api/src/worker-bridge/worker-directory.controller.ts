import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
type Input=Record<string,unknown>;
@Controller('internal/worker')
export class WorkerDirectoryController {
 constructor(private readonly db:DatabaseService){}
 private validate(auth:string|undefined,body:Input):[string,string]{
  const secret=process.env.WORKER_DISPATCH_SECRET;
  if(!secret||!auth?.startsWith('Bearer '))throw new ForbiddenException();
  const a=Buffer.from(auth.slice(7)),b=Buffer.from(secret);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw new ForbiddenException();
  if(typeof body.workerId!=='string'||!/^[a-zA-Z0-9._:-]{1,120}$/.test(body.workerId))throw new ForbiddenException();
  if(typeof body.sessionId!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(body.sessionId))throw new ForbiddenException();
  return [body.workerId,body.sessionId];
 }
 private data(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ForbiddenException();
  const v=value as Record<string,unknown>;
  if(typeof v.id!=='string'||v.id.length>250||v.id.length===0)throw new ForbiddenException();
  return v;
 }
 private str(v:unknown,max=250):string|null{return typeof v==='string'?v.slice(0,max):null;}
 @Post('sessions/contact') @HttpCode(200)
 async contact(@Headers('authorization') auth:string|undefined,@Body() body:Input){
  const [worker,id]=this.validate(auth,body),c=this.data(body.contact),jid=c.id as string;
  const phone=jid.endsWith('@g.us')?null:jid.split('@')[0].split(':')[0];
  await this.db.query(`INSERT INTO whatsapp_contacts(session_id,organization_id,jid,phone_number,display_name,notify_name,verified_name,is_business,updated_at) SELECT id,organization_id,$3,$4,$5,$6,$7,$8,now() FROM whatsapp_sessions WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL ON CONFLICT(session_id,jid) DO UPDATE SET phone_number=EXCLUDED.phone_number,display_name=COALESCE(EXCLUDED.display_name,whatsapp_contacts.display_name),notify_name=COALESCE(EXCLUDED.notify_name,whatsapp_contacts.notify_name),verified_name=COALESCE(EXCLUDED.verified_name,whatsapp_contacts.verified_name),is_business=EXCLUDED.is_business,updated_at=now()`,[id,worker,jid,phone,this.str(c.name),this.str(c.notify),this.str(c.verifiedName),Boolean(c.businessName||c.verifiedName)]);
  return {ok:true};
 }
 @Post('sessions/chat') @HttpCode(200)
 async chat(@Headers('authorization') auth:string|undefined,@Body() body:Input){
  const [worker,id]=this.validate(auth,body),c=this.data(body.chat),jid=c.id as string;
  const count=Number(c.unreadCount??0),timestamp=Number(c.conversationTimestamp);
  if(!Number.isSafeInteger(count)||count<0||count>1000000)throw new ForbiddenException();
  const last=c.conversationTimestamp==null?null:Number.isFinite(timestamp)&&timestamp>0&&timestamp<32503680000?new Date(timestamp*1000).toISOString():null;
  await this.db.query(`INSERT INTO whatsapp_chats(session_id,organization_id,jid,chat_type,name,unread_count,last_message_at,updated_at) SELECT id,organization_id,$3,$4,$5,$6,$7::timestamptz,now() FROM whatsapp_sessions WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL ON CONFLICT(session_id,jid) DO UPDATE SET chat_type=EXCLUDED.chat_type,name=COALESCE(EXCLUDED.name,whatsapp_chats.name),unread_count=EXCLUDED.unread_count,last_message_at=COALESCE(EXCLUDED.last_message_at,whatsapp_chats.last_message_at),updated_at=now()`,[id,worker,jid,jid.endsWith('@g.us')?'group':'direct',this.str(c.name),count,last]);
  return {ok:true};
 }
 @Post('sessions/group') @HttpCode(200)
 async group(@Headers('authorization') auth:string|undefined,@Body() body:Input){
  const [worker,id]=this.validate(auth,body),g=this.data(body.group);
  const size=Array.isArray(g.participants)?g.participants.length:Number(g.size??0);
  if(!Number.isSafeInteger(size)||size<0||size>100000)throw new ForbiddenException();
  await this.db.query(`INSERT INTO whatsapp_groups(session_id,organization_id,jid,subject,owner_jid,participant_count,announce,restrict_members,updated_at) SELECT id,organization_id,$3,$4,$5,$6,$7,$8,now() FROM whatsapp_sessions WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL ON CONFLICT(session_id,jid) DO UPDATE SET subject=COALESCE(EXCLUDED.subject,whatsapp_groups.subject),owner_jid=COALESCE(EXCLUDED.owner_jid,whatsapp_groups.owner_jid),participant_count=EXCLUDED.participant_count,announce=EXCLUDED.announce,restrict_members=EXCLUDED.restrict_members,updated_at=now()`,[id,worker,g.id,this.str(g.subject),this.str(g.owner),size,Boolean(g.announce),Boolean(g.restrict)]);
  return {ok:true};
 }
}
