// Fail-closed patch of the LIVE Cloudflare D1 API Worker, not the legacy Nest API.
export function patchApi(source) {
 const anchor='M.get("/:sessionId", async (e) => {';
 if(source.split(anchor).length!==2)throw Error('Unexpected live API session router layout');
 if(source.includes('RELAYWA_SESSION_STATISTICS_V1'))throw Error('Statistics patch already present');
 const endpoint=`// RELAYWA_SESSION_STATISTICS_V1
M.get("/:sessionId/statistics", async (e) => {
  await w(e.env.DB, e.get("auth"), m.SESSIONS_READ, e.req.param("sessionId") ?? void 0);
  const auth=e.get("auth"), id=e.req.param("sessionId");
  const session=await Le(e.env.DB,auth.org,id);
  const counts=await e.env.DB.prepare(\`SELECT COUNT(*) AS total,
    SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS successful,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN status NOT IN ('sent','failed') THEN 1 ELSE 0 END) AS pending,
    MAX(sent_at) AS last_sent_at, MAX(failed_at) AS last_failed_at
    FROM whatsapp_messages WHERE organization_id=? AND session_id=? AND direction='outbound'\`)
    .bind(auth.org,id).first();
  const latest=await e.env.DB.prepare(\`SELECT id,message_type,text_body,media_caption,recipient_phone,status,
     created_at,sent_at,failed_at,last_error FROM whatsapp_messages
     WHERE organization_id=? AND session_id=? AND direction='outbound'
     ORDER BY created_at DESC,id DESC LIMIT 1\`).bind(auth.org,id).first();
  return e.json({
    sessionId:id,status:session.status,engine:session.engine,phoneNumber:session.phone_number,
    lastConnectedAt:session.last_connected_at,lastDisconnectedAt:session.last_disconnected_at,
    createdAt:session.created_at,total:Number(counts?.total||0),
    successful:Number(counts?.successful||0),failed:Number(counts?.failed||0),
    pending:Number(counts?.pending||0),lastSentAt:counts?.last_sent_at||null,
    lastFailedAt:counts?.last_failed_at||null,latestMessage:latest||null
  });
});
`;
 return source.replace(anchor,endpoint+anchor);
}
