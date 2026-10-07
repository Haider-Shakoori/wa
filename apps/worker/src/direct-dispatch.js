import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export async function startDirectDispatch({store,sessions,secret=process.env.WORKER_DISPATCH_SECRET||process.env.JWT_SECRET,host=process.env.WORKER_DISPATCH_HOST||'127.0.0.1',port=Number(process.env.WORKER_DISPATCH_PORT||3002)}) {
 if(!secret)throw new Error('WORKER_DISPATCH_SECRET or JWT_SECRET is required');
 const server=createServer(async(req,res)=>{
  const respond=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
  const actual=Buffer.from(req.headers.authorization||'');const expected=Buffer.from('Bearer '+secret);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return respond(401,{message:'Unauthorized'});
  const match=req.url?.match(/^\/dispatch\/([0-9a-f-]{36})$/i);
  if(req.method!=='POST'||!match)return respond(404,{message:'Not found'});
  let message;
  try{
   message=await store.claimDirectMessage(match[1]);
   if(!message)return respond(409,{message:'Message is already dispatched or session is unavailable'});
   if(message.message_type==='text')await sessions.sendText(message.session_id,message);
   else if(['image','video','audio','document'].includes(message.message_type))await sessions.sendMedia(message.session_id,message);
   else await sessions.sendAction(message.session_id,message);
   respond(200,{sent:true,messageId:message.id});
  }catch(error){
   if(message)await store.markMessageFailed(message.id,error).catch(()=>{});
   respond(502,{message:String(error?.message||error).slice(0,500),messageId:message?.id});
  }
 });
 server.requestTimeout=120000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 return {server,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
