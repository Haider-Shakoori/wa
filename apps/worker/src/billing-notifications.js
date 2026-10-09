import pg from 'pg';
import nodemailer from 'nodemailer';

const enabled = () => String(process.env.BILLING_EMAIL_ENABLED || '').toLowerCase() === 'true';
const configured = () => enabled() && Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM
  && (!process.env.SMTP_USER || process.env.SMTP_PASS));
const templates = {
  subscription_activated: ['Your RelayWA subscription is active', 'Your subscription payment was confirmed and your plan is active.'],
  subscription_renewed: ['RelayWA subscription renewed', 'Your subscription renewal payment was confirmed.'],
  payment_failed: ['Action required: RelayWA payment failed', 'Your subscription payment was unsuccessful. Please update your payment method.'],
  subscription_canceled: ['RelayWA subscription canceled', 'Your RelayWA subscription has ended.'],
};
function escapeHtml(s) {
  return String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
export async function deliverBillingNotificationsOnce({pool,transport,now = new Date()}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT id,organization_id,kind,payload,attempts
      FROM billing_notification_outbox WHERE status='pending' AND next_attempt_at <= $1
      ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`,[now]);
    const row=result.rows[0];
    if(!row) {await client.query('COMMIT');return false;}
    const recipient=await client.query(`SELECT u.email FROM organization_memberships m
      JOIN users u ON u.id=m.user_id
      WHERE m.organization_id=$1 AND m.status='active' AND m.role IN ('owner','admin')
      AND u.disabled_at IS NULL ORDER BY CASE WHEN m.role='owner' THEN 0 ELSE 1 END
      LIMIT 1`,[row.organization_id]);
    const to=recipient.rows[0]?.email;
    const template=templates[row.kind];
    try {
      if(!to)throw new Error('Billing account owner email unavailable');
      if(!template)throw new Error('Unknown billing notification kind');
      const [subject,text]=template;
      const detail=row.payload?.planCode ? ` Plan: ${row.payload.planCode}.` : '';
      const body=text+detail+' Visit https://relaywa.com/subscription for account and payment details.';
      await transport.sendMail({
        from:process.env.SMTP_FROM,to,subject,
        text:body,html:`<p>${escapeHtml(body)}</p><p><a href="https://relaywa.com/subscription">Manage subscription</a></p>`,
        messageId:`<relaywa-billing-${row.id}@relaywa.com>`,
      });
      await client.query(`UPDATE billing_notification_outbox
        SET status='sent',sent_at=now(),attempts=attempts+1
        WHERE id=$1`,[row.id]);
    }catch(error) {
      const attempts=Number(row.attempts||0)+1;
      await client.query(`UPDATE billing_notification_outbox
        SET status=CASE WHEN $2>=5 THEN 'failed' ELSE 'pending' END,
            attempts=$2,next_attempt_at=now()+($3*interval '1 minute'),
            last_error=$4 WHERE id=$1`,
        [row.id,attempts,Math.min(60,2**attempts),String(error?.message??error).slice(0,300)]);
    }
    await client.query('COMMIT');
    return true;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
}
export function startBillingNotificationWorker({databaseUrl,signal}) {
  if(!configured()) {
    console.log('[billing-mail] disabled: set BILLING_EMAIL_ENABLED=true and valid SMTP credentials');
    return () => {};
  }
  const pool=new pg.Pool({connectionString:databaseUrl,max:2});
  const transport=nodemailer.createTransport({
    host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),
    secure:String(process.env.SMTP_SECURE||'').toLowerCase()==='true',
    ...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}:{}),
  });
  let working=false;
  const tick=async()=>{
    if(working||signal?.aborted)return;
    working=true;
    try{for(let i=0;i<10;i++){if(!await deliverBillingNotificationsOnce({pool,transport}))break;}}
    catch(error){console.error('[billing-mail] delivery cycle failed',String(error?.message||error));}
    finally{working=false;}
  };
  const timer=setInterval(()=>void tick(),60_000);
  void tick();
  return ()=>{clearInterval(timer);void pool.end();};
}
