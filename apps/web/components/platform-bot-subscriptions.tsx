'use client';
import {useEffect,useState} from 'react';
import {api} from '../lib/api';
type Row={organization_id:string;organization_name:string;plan_code:string;status:string;max_bots:number;monthly_reply_limit:number;bot_count:number;current_period_end:string|null};
export function PlatformBotSubscriptions({token}:{token:string}){
 const [rows,setRows]=useState<Row[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
   if(!token)return;
   let cancelled=false;
   api<Row[]>('/platform/bot-subscriptions',token)
     .then(data=>{if(!cancelled)setRows(data);})
     .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Unable to load Bot Builder subscriptions');})
     .finally(()=>{if(!cancelled)setLoading(false);});
   return ()=>{cancelled=true;};
 },[token]);
 return <section className="panel platform-detail-panel">
   <h2>Bot Builder subscriptions</h2>
   <p>Read-only overview. No billing or WhatsApp session changes can be made here.</p>
   {loading?<p>Loading…</p>:error?<p role="alert">{error}</p>:
   <div style={{overflowX:'auto'}}><table><thead><tr>
     <th>Customer</th><th>Plan</th><th>Status</th><th>Bots</th><th>Reply allowance</th><th>Period end</th>
   </tr></thead><tbody>{rows.map(row=><tr key={row.organization_id}>
     <td>{row.organization_name}</td><td>{row.plan_code}</td><td>{row.status}</td>
     <td>{row.bot_count} / {row.max_bots}</td><td>{row.monthly_reply_limit}</td>
     <td>{row.current_period_end?new Date(row.current_period_end).toLocaleDateString():'—'}</td>
   </tr>)}</tbody></table>{rows.length===0&&<p>No Bot Builder subscriptions yet.</p>}</div>}
 </section>;
}
