import pg from 'pg';
import {existsSync} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadEnvFile} from 'node:process';
const root=resolve(import.meta.dirname,'../../..');
if(!process.env.DATABASE_URL&&existsSync(resolve(root,'.env')))loadEnvFile(resolve(root,'.env'));
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
 await client.query('SELECT pg_advisory_lock(726519)');
 await client.query('CREATE TABLE IF NOT EXISTS relaywa_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const localLedger = await client.query("SELECT to_regclass('public.local_applied_migrations') AS name");
 if(localLedger.rows[0].name) {
  await client.query(`INSERT INTO relaywa_schema_migrations (name)
   SELECT name FROM local_applied_migrations WHERE name <> '012_webhooks.sql'
   ON CONFLICT (name) DO NOTHING`);
 }
 const directory=resolve(import.meta.dirname,'../migrations');
 // This obsolete draft conflicts with the deployed webhook delivery schema.
 const files=(await readdir(directory)).filter(name=>name.endsWith('.sql')&&name!=='012_webhooks.sql').sort();
 for(const name of files){
  if((await client.query('SELECT 1 FROM relaywa_schema_migrations WHERE name=$1',[name])).rowCount)continue;
  await client.query('BEGIN');
  try{await client.query(await readFile(resolve(directory,name),'utf8'));await client.query('INSERT INTO relaywa_schema_migrations (name) VALUES ($1)',[name]);await client.query('COMMIT');console.log('Applied '+name);}catch(error){await client.query('ROLLBACK');throw error;}
 }
}finally{await client.query('SELECT pg_advisory_unlock(726519)');await client.end();}
