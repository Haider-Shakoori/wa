// Downloads a public-domain IPtoASN country table into the local PostgreSQL lookup.
// Run after migration 033: node apps/api/scripts/import-website-geoip.mjs
// Source: https://iptoasn.com/ (PDDL public-domain country ranges).
// No visitor IPs are sent to this provider.
import { get } from 'node:https';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { isIP } from 'node:net';
import pg from 'pg';

const urls=[
  'https://iptoasn.com/data/ip2country-v4.tsv.gz',
  'https://iptoasn.com/data/ip2country-v6.tsv.gz',
];
const dbUrl=process.env.DATABASE_URL;
if(!dbUrl)throw new Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:dbUrl});
await client.connect();
function download(url){
  return new Promise((resolve,reject)=>{
    const req=get(url,{timeout:30000,headers:{'user-agent':'RelayWA-GeoIP-Importer/1.0'}},response=>{
      if(response.statusCode!==200){
        response.resume();reject(new Error('IP country download returned '+response.statusCode));return;
      }
      const unzip=createGunzip();
      response.on('error',reject);unzip.on('error',reject);
      resolve(response.pipe(unzip));
    });
    req.on('timeout',()=>req.destroy(new Error('IP country download timed out')));
    req.on('error',reject);
  });
}
let imported=0;
try{
  // Keep the prior geographic dataset available throughout the download.
  await client.query('CREATE TABLE IF NOT EXISTS website_geoip_ranges_import (LIKE website_geoip_ranges INCLUDING DEFAULTS)');
  await client.query('TRUNCATE website_geoip_ranges_import');
  const batch=[];
  const flush=async()=>{
    if(!batch.length)return;
    const values=[];const placeholders=[];
    for(const [start,end,country] of batch){
      const index=values.length;
      values.push(start,end,country);
      placeholders.push(`($${index+1}::inet,$${index+2}::inet,$${index+3}::char(2))`);
    }
    await client.query(`INSERT INTO website_geoip_ranges_import (range_start,range_end,country_code)
      VALUES ${placeholders.join(',')}`,values);
    imported+=batch.length;batch.length=0;
  };
  for(const url of urls){
    const stream=await download(url);
    let lines=0;
    for await(const text of createInterface({input:stream,crlfDelay:Infinity})){
      if(!text || text.startsWith('#'))continue;
      const parts=text.split('\t');
      if(parts.length<3)continue;
      const start=parts[0].trim(),end=parts[1].trim(),country=parts[2].trim().toUpperCase();
      if(isIP(start)===0 || isIP(start)!==isIP(end) || !/^[A-Z]{2}$/.test(country))continue;
      batch.push([start,end,country]);lines++;
      if(batch.length>=400)await flush();
      if(imported>3_000_000)throw new Error('Country dataset exceeded safety limit');
    }
    await flush();
    if(lines<1000)throw new Error('Unexpectedly small country dataset for '+url);
    console.log('Validated '+lines+' ranges from '+url);
  }
  if(imported<10000)throw new Error('Country dataset is incomplete: '+imported);
  await client.query('BEGIN');
  try{
    await client.query('TRUNCATE website_geoip_ranges');
    await client.query('INSERT INTO website_geoip_ranges SELECT * FROM website_geoip_ranges_import');
    await client.query('TRUNCATE website_geoip_ranges_import');
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  console.log('Activated '+imported+' offline country ranges');
}finally{
  await client.end();
}
