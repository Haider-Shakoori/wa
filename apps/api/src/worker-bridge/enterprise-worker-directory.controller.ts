import {Body,Controller,ForbiddenException,Headers,HttpCode,Post} from '@nestjs/common';
import {DatabaseService} from '../database/database.service';
import {authorizeEnterpriseWorker} from './enterprise-worker-authorization';

type Input={workerId?:unknown;sessionId?:unknown;contact?:unknown;chat?:unknown;group?:unknown};
const uuid=(v:unknown):string=>{
 if(typeof v!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(v))throw new ForbiddenException();
 return v;
};
const record=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new ForbiddenException();
 return v as Record<string,unknown>;
};
const string=(v:unknown,max:number):string|null=>{
 if(v==null)return null;
 if(typeof v!=='string'||v.length>max)throw new ForbiddenException();
 return v;
};
@Controller('internal/enterprise-worker')
export class EnterpriseWorkerDirectoryController {
 constructor(private readonly db:DatabaseService){}
 private async scope(h:string|undefined,b:Input){
  const w=await authorizeEnterpriseWorker(this.db,h,b?.workerId);
  return {id:uuid(b.sessionId),organizationId:w.organizationId,workerId:w.workerId};
 }
 @Post('directory/contact') @HttpCode(200)
 async contact(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const s=await this.scope(h,b),c=record(b.contact),jid=string(c.id,250);
  if(!jid)throw new ForbiddenException();
  const phone=jid.endsWith('@g.us')?null:jid.split('@')[0].split(':')[0];
  const r=await this.db.query(`INSERT INTO whatsapp_contacts
   (session_id,organization_id,jid,phone_number,display_name,notify_name,verified_name,is_business,updated_at)
   SELECT s.id,s.organization_id,$4,$5,$6,$7,$8,$9,now() FROM whatsapp_sessions s
   WHERE s.id=$1 AND s.organization_id=$2 AND s.worker_id=$3 AND s.deleted_at IS NULL
   ON CONFLICT(session_id,jid) DO UPDATE SET
   phone_number=EXCLUDED.phone_number,display_name=COALESCE(EXCLUDED.display_name,whatsapp_contacts.display_name),
   notify_name=COALESCE(EXCLUDED.notify_name,whatsapp_contacts.notify_name),
   verified_name=COALESCE(EXCLUDED.verified_name,whatsapp_contacts.verified_name),
   is_business=EXCLUDED.is_business,updated_at=now() RETURNING jid`,
   [s.id,s.organizationId,s.workerId,jid,phone,string(c.name,160),string(c.notify,160),
    string(c.verifiedName,160),Boolean(c.businessName||c.verifiedName)]);
  return {updated:r.rowCount===1};
 }
 @Post('directory/chat') @HttpCode(200)
 async chat(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const s=await this.scope(h,b),c=record(b.chat),jid=string(c.id,250);
  if(!jid)throw new ForbiddenException();
  const unread=c.unreadCount??0;
  if(!Number.isSafeInteger(Number(unread))||Number(unread)<0||Number(unread)>1000000)throw new ForbiddenException();
  const ts=c.conversationTimestamp==null?null:Number(c.conversationTimestamp);
  if(ts!==null&&(!Number.isSafeInteger(ts)||ts<0||ts>4102444800))throw new ForbiddenException();
  const r=await this.db.query(`INSERT INTO whatsapp_chats
   (session_id,organization_id,jid,chat_type,name,unread_count,last_message_at,updated_at)
   SELECT s.id,s.organization_id,$4,$5,$6,$7,$8::timestamptz,now() FROM whatsapp_sessions s
   WHERE s.id=$1 AND s.organization_id=$2 AND s.worker_id=$3 AND s.deleted_at IS NULL
   ON CONFLICT(session_id,jid) DO UPDATE SET chat_type=EXCLUDED.chat_type,
   name=COALESCE(EXCLUDED.name,whatsapp_chats.name),unread_count=EXCLUDED.unread_count,
   last_message_at=COALESCE(EXCLUDED.last_message_at,whatsapp_chats.last_message_at),
   updated_at=now() RETURNING jid`,
   [s.id,s.organizationId,s.workerId,jid,jid.endsWith('@g.us')?'group':'direct',
    string(c.name,160),Number(unread),ts===null?null:new Date(ts*1000).toISOString()]);
  return {updated:r.rowCount===1};
 }
 @Post('directory/group') @HttpCode(200)
 async group(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const s=await this.scope(h,b),g=record(b.group),jid=string(g.id,250);
  if(!jid||!jid.endsWith('@g.us'))throw new ForbiddenException();
  const count=Array.isArray(g.participants)?g.participants.length:Number(g.size??0);
  if(!Number.isSafeInteger(count)||count<0||count>100000)throw new ForbiddenException();
  const r=await this.db.query(`INSERT INTO whatsapp_groups
   (session_id,organization_id,jid,subject,owner_jid,participant_count,announce,restrict_members,updated_at)
   SELECT s.id,s.organization_id,$4,$5,$6,$7,$8,$9,now() FROM whatsapp_sessions s
   WHERE s.id=$1 AND s.organization_id=$2 AND s.worker_id=$3 AND s.deleted_at IS NULL
   ON CONFLICT(session_id,jid) DO UPDATE SET
   subject=COALESCE(EXCLUDED.subject,whatsapp_groups.subject),
   owner_jid=COALESCE(EXCLUDED.owner_jid,whatsapp_groups.owner_jid),
   participant_count=EXCLUDED.participant_count,announce=EXCLUDED.announce,
   restrict_members=EXCLUDED.restrict_members,updated_at=now() RETURNING jid`,
   [s.id,s.organizationId,s.workerId,jid,string(g.subject,250),string(g.owner,250),count,
    Boolean(g.announce),Boolean(g.restrict)]);
  return {updated:r.rowCount===1};
 }
}
