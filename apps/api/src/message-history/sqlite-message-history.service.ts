import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, statSync, chmodSync, accessSync, constants } from 'node:fs';
import { isAbsolute, dirname } from 'node:path';
import { DatabaseService } from '../database/database.service';

type Policy = {
  enabled:boolean;
  enabled_at:Date|null;
  retention_days:number;
  max_file_mb:number;
};
type Message = {
  id:string; organization_id:string; session_id:string; direction:string;
  message_type:string; status:string; recipient_phone:string|null;
  sender_phone:string|null; text_body:string|null; media_caption:string|null;
  media_file_name:string|null; media_size_bytes:number|null;
  created_at:Date; updated_at:Date;
};

@Injectable()
export class SqliteMessageHistoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger=new Logger(SqliteMessageHistoryService.name);
  private readonly location=String(process.env.RELAYWA_MESSAGE_HISTORY_SQLITE_PATH??'').trim();
  private handle:DatabaseSync|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private busy=false;
  private lastError:string|null=null;
  constructor(private readonly postgres:DatabaseService) {}

  get configured() {
    // Operators must mount a writable persistent directory into the API
    // container. The path should never point into the ephemeral image layer.
    if(!this.location || !isAbsolute(this.location))return false;
    try {
      if(!statSync(dirname(this.location)).isDirectory())return false;
      accessSync(dirname(this.location),constants.W_OK);
      return true;
    }catch{return false;}
  }

  async onModuleInit() {
    // Only the API owns this SQLite archive: the session worker continues to
    // use PostgreSQL for safe message dispatch, acknowledgments and recovery.
    this.timer=setInterval(()=>{void this.sync().catch(error=>{
      this.lastError=String(error instanceof Error?error.message:error).slice(0,250);
      this.logger.error('Optional message history archive failed: '+this.lastError);
    });},30_000);
    this.timer.unref();
    // Do not create a SQLite file on startup while storage is disabled.
  }

  onModuleDestroy() {
    if(this.timer)clearInterval(this.timer);
    this.handle?.close();
    this.handle=null;
  }

  status() {
    const size=(suffix:string)=> {
      try {return existsSync(this.location+suffix)?statSync(this.location+suffix).size:0;}
      catch {return 0;}
    };
    return {
      configured:this.configured,
      databaseBytes:this.configured?size('')+size('-wal')+size('-shm'):0,
      // Prevent exposing absolute host-mounted paths to browser clients.
      lastError:this.lastError,
    };
  }

  private open() {
    if(!this.configured)throw new Error('Persistent SQLite path not configured');
    if(this.handle)return this.handle;
    const db=new DatabaseSync(this.location,{timeout:5000});
    try {
      chmodSync(this.location,0o600);
      db.exec(`PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=5000;
        PRAGMA auto_vacuum=INCREMENTAL;
        CREATE TABLE IF NOT EXISTS message_history (
          id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, session_id TEXT NOT NULL,
          direction TEXT NOT NULL, message_type TEXT NOT NULL, status TEXT NOT NULL,
          recipient_phone TEXT, sender_phone TEXT,
          text_body TEXT, media_caption TEXT, media_file_name TEXT,
          media_size_bytes INTEGER,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_message_history_tenant_session
          ON message_history (organization_id,session_id,created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_message_history_created
          ON message_history (created_at);
        CREATE TABLE IF NOT EXISTS message_history_cursor (
          singleton INTEGER PRIMARY KEY CHECK(singleton=1),
          last_updated_at TEXT NOT NULL,
          last_id TEXT NOT NULL
        );`);
      this.handle=db;
      return db;
    }catch(error){db.close();throw error;}
  }

  private async policy():Promise<Policy> {
    const {rows}=await this.postgres.query<Policy>(`SELECT enabled,enabled_at,
      retention_days,max_file_mb FROM message_history_storage_settings
      WHERE id='global'`);
    return rows[0]??{enabled:false,enabled_at:null,retention_days:7,max_file_mb:1024};
  }

  async sync() {
    if(this.busy)return;
    this.busy=true;
    try {
      const settings=await this.policy();
      if(!this.configured)return;
      if(!settings.enabled && !existsSync(this.location))return;
      const sqlite=this.open();
      const threshold=new Date(Date.now()-settings.retention_days*86400_000).toISOString();
      sqlite.prepare('DELETE FROM message_history WHERE created_at<?').run(threshold);
      sqlite.exec('PRAGMA incremental_vacuum(256)');
      if(!settings.enabled||!settings.enabled_at)return;
      // Limit archival work to avoid adding latency to the primary API.
      // The cursor is persisted in SQLite, and records are idempotently
      // upserted. Existing historical rows are not backfilled on enable.
      const epoch=new Date(settings.enabled_at).toISOString();
      const cursor=sqlite.prepare(`SELECT last_updated_at,last_id FROM
        message_history_cursor WHERE singleton=1`).get() as
        {last_updated_at:string;last_id:string}|undefined;
      const lastUpdated=cursor && cursor.last_updated_at>epoch?cursor.last_updated_at:epoch;
      const lastId=cursor && cursor.last_updated_at>epoch?cursor.last_id:'00000000-0000-0000-0000-000000000000';
      const maxBytes=settings.max_file_mb*1024*1024;
      if(this.status().databaseBytes>=maxBytes) {
        this.lastError='SQLite archive is at its configured capacity; new history is paused';
        return;
      }
      let afterDate=lastUpdated,afterId=lastId;
      for(let page=0;page<6;page++) {
        const {rows}=await this.postgres.query<Message>(`SELECT
          id::text,organization_id::text,session_id::text,direction,
          message_type,status,recipient_phone,sender_phone,text_body,
          media_caption,media_file_name,media_size_bytes,created_at,updated_at
          FROM whatsapp_messages
          WHERE created_at >= $1::timestamptz
            AND (updated_at,id) > ($2::timestamptz,$3::uuid)
            AND status IN ('sent','received','failed')
          ORDER BY updated_at,id LIMIT 250`,
          [epoch,afterDate,afterId]);
        if(!rows.length)break;
        const insert=sqlite.prepare(`INSERT INTO message_history(
          id,organization_id,session_id,direction,message_type,status,
          recipient_phone,sender_phone,text_body,media_caption,media_file_name,
          media_size_bytes,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET status=excluded.status,
          text_body=excluded.text_body,media_caption=excluded.media_caption,
          updated_at=excluded.updated_at`);
        const saveCursor=sqlite.prepare(`INSERT INTO message_history_cursor
          (singleton,last_updated_at,last_id) VALUES(1,?,?)
          ON CONFLICT(singleton) DO UPDATE SET
            last_updated_at=excluded.last_updated_at,last_id=excluded.last_id`);
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          for(const row of rows){
            insert.run(row.id,row.organization_id,row.session_id,row.direction,
              row.message_type,row.status,row.recipient_phone,row.sender_phone,
              row.text_body,row.media_caption,row.media_file_name,
              row.media_size_bytes,new Date(row.created_at).toISOString(),
              new Date(row.updated_at).toISOString());
          }
          const last=rows.at(-1)!;
          afterDate=new Date(last.updated_at).toISOString();
          afterId=last.id;
          saveCursor.run(afterDate,afterId);
          sqlite.exec('COMMIT');
        }catch(error){sqlite.exec('ROLLBACK');throw error;}
        if(rows.length<250||this.status().databaseBytes>=maxBytes)break;
      }
      this.lastError=null;
    }finally{this.busy=false;}
  }
}
