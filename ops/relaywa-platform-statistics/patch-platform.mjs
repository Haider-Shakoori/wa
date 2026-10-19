// Target exact deployed Cloudflare platform admin Workers, never the legacy Nest build.
export function patchPlatform(original){
 const anchor='async function sessionsList(env) {';
 if(original.split(anchor).length!==2)throw Error('Admin session API fingerprint mismatch');
 if(original.includes('RELAYWA_PLATFORM_SESSION_STATS_V1'))throw Error('Already patched');
 const func=`// RELAYWA_PLATFORM_SESSION_STATS_V1
async function platformSessionStatistics(env,id){
 const session=(await q(env.DB,"SELECT id,organization_id,name,status,engine,phone_number,worker_id,last_connected_at,last_disconnected_at,created_at FROM whatsapp_sessions WHERE id=? AND deleted_at IS NULL",[id]))[0];
 if(!session)return json({message:"Session not found"},404);
 const counts=(await q(env.DB,\`SELECT COUNT(*) total,
 SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) successful,
 SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed,
 SUM(CASE WHEN status NOT IN ('sent','failed') THEN 1 ELSE 0 END) pending,
 MAX(sent_at) lastSentAt,MAX(failed_at) lastFailedAt FROM whatsapp_messages
 WHERE organization_id=? AND session_id=? AND direction='outbound'\`,[session.organization_id,id]))[0]||{};
 const last=(await q(env.DB,\`SELECT id,message_type,text_body,media_caption,recipient_phone,status,created_at,sent_at,last_error
 FROM whatsapp_messages WHERE organization_id=? AND session_id=? AND direction='outbound'
 ORDER BY created_at DESC,id DESC LIMIT 1\`,[session.organization_id,id]))[0]||null;
 return json({sessionId:id,name:session.name,status:session.status,engine:session.engine,
 phoneNumber:session.phone_number,workerId:session.worker_id,lastConnectedAt:session.last_connected_at,
 lastDisconnectedAt:session.last_disconnected_at,createdAt:session.created_at,
 total:Number(counts.total||0),successful:Number(counts.successful||0),failed:Number(counts.failed||0),
 pending:Number(counts.pending||0),lastSentAt:counts.lastSentAt||null,lastFailedAt:counts.lastFailedAt||null,
 latestMessage:last});
}
`;
 let s=original.replace(anchor,func+anchor);
 const route='["GET", "/platform/sessions", null, (e) => sessionsList(e)],';
 if(s.split(route).length!==2)throw Error('Admin routes fingerprint mismatch');
 return s.replace(route,route+'\n  ["GET", "/platform/sessions/:id/statistics", null, (e,r,a,p) => platformSessionStatistics(e,p[0])],');
}
