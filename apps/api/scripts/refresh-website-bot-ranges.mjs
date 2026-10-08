// Refresh official crawler CIDR lists OUTSIDE request handling.
// Usage: DATABASE_URL=... node apps/api/scripts/refresh-website-bot-ranges.mjs
// Run daily on the deployment host; failed provider updates retain prior ranges.
import { isIP } from 'node:net';
import pg from 'pg';

const sources=[
  ['Googlebot','https://developers.google.com/static/crawling/ipranges/common-crawlers.json'],
  ['Bingbot','https://www.bing.com/toolbox/bingbot.json'],
  ['Applebot','https://search.developer.apple.com/applebot.json'],
];
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
await client.connect();
let failures=0;
try{
  await client.query('SELECT pg_advisory_lock(86753091)');
  for (const [family,url] of sources) {
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error',
        headers:{'user-agent':'RelayWA-Crawler-List-Updater/1.0'}});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const raw=await response.text();
      if(raw.length>1_500_000)throw new Error('Unexpectedly large crawler range file');
      const payload=JSON.parse(raw);
      if(!Array.isArray(payload?.prefixes))throw new Error('Missing crawler IP prefixes');
      const list=[...new Set(payload.prefixes.map(row=>row?.ipv4Prefix??row?.ipv6Prefix).filter(Boolean))];
      if(list.length<5||list.length>8000)throw new Error('Unexpected crawler IP range count: '+list.length);
      for(const range of list){
        const [address,length]=String(range).split('/');
        const familyLength=isIP(address);
        const size=Number(length);
        if(!familyLength||!Number.isInteger(size)||size<0||size>(familyLength===4?32:128)){
          throw new Error('Invalid range in official source');
        }
      }
      await client.query('BEGIN');
      try{
        await client.query('DELETE FROM website_bot_ranges WHERE family=$1',[family]);
        await client.query(`INSERT INTO website_bot_ranges(family,address_range)
          SELECT $1, unnest($2::cidr[])`,[family,list]);
        await client.query(`INSERT INTO website_bot_range_sources (family,refreshed_at,prefix_count)
          VALUES ($1,now(),$2) ON CONFLICT(family) DO UPDATE
          SET refreshed_at=excluded.refreshed_at,prefix_count=excluded.prefix_count`,[family,list.length]);
        await client.query('COMMIT');
      }catch(e){await client.query('ROLLBACK');throw e;}
      console.log('Refreshed',family,'verified CIDRs:',list.length);
    }catch(error){failures++;console.error('Retained prior',family,'CIDRs:',error.message);}
  }
}finally{
  try{await client.query('SELECT pg_advisory_unlock(86753091)')}finally{await client.end();}
}
if(failures)process.exitCode=1;
