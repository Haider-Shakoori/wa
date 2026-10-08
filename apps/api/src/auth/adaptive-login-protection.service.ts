import { HttpException, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type Attempts = {failed_count:number};
type Context = {ip?:string;userAgent?:string};
const WINDOW_MINUTES=15;
const ACCOUNT_IP_THRESHOLD=3;
const IP_THRESHOLD=12;
const ACCOUNT_THRESHOLD=8;
const IP_HARD_LIMIT=60;

@Injectable()
export class AdaptiveLoginProtectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger=new Logger(AdaptiveLoginProtectionService.name);
  private cleanupTimer:ReturnType<typeof setInterval>|null=null;
  constructor(private readonly db:DatabaseService) {}

  onModuleInit() {
    // Keep failed-attempt fingerprints short-lived without adding cleanup
    // work to the public login request path.
    this.cleanupTimer=setInterval(()=>{
      void this.db.query(`DELETE FROM auth_login_attempt_windows
        WHERE last_failed_at<now()-interval '7 days'`)
        .catch(error=>this.logger.warn('Login counter cleanup unavailable: '+
          (error instanceof Error?error.name:'error')));
    },6*60*60*1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if(this.cleanupTimer)clearInterval(this.cleanupTimer);
  }

  private get keysConfigured() {
    return Boolean(process.env.TURNSTILE_SITE_KEY?.trim() &&
      process.env.TURNSTILE_SECRET_KEY?.trim());
  }

  private fingerprint(kind:string,value:string) {
    const key=process.env.LOGIN_ATTEMPT_HASH_SECRET || process.env.JWT_SECRET || 'local-dev-login-window';
    return createHmac('sha256',key).update('relaywa-login:'+kind+':'+value).digest('hex');
  }

  private keys(email:string,context?:Context) {
    const normalized=email.trim().toLowerCase();
    const ip=(context?.ip||'unknown').slice(0,64);
    return {
      pair:this.fingerprint('account-ip',normalized+'\n'+ip),
      address:this.fingerprint('ip',ip),
      account:this.fingerprint('account',normalized),
    };
  }

  private async counters(email:string,context?:Context) {
    const keys=this.keys(email,context);
    const {rows}=await this.db.query<Attempts & {lookup_hash:string}>(`SELECT lookup_hash,failed_count
      FROM auth_login_attempt_windows
      WHERE lookup_hash=ANY($1::text[])
        AND last_failed_at>now()-interval '15 minutes'`,[Object.values(keys)]);
    const counts=new Map(rows.map(row=>[row.lookup_hash,Number(row.failed_count)]));
    return {
      pair:counts.get(keys.pair)??0,
      address:counts.get(keys.address)??0,
      account:counts.get(keys.account)??0,
    };
  }

  async status(email:string,context?:Context) {
    // Identical response structure for existing and unknown emails to prevent
    // account enumeration. IP-only counts also catch password spraying.
    const counts=await this.counters(email,context);
    const required=counts.pair>=ACCOUNT_IP_THRESHOLD ||
      counts.address>=IP_THRESHOLD || counts.account>=ACCOUNT_THRESHOLD;
    const blocked=counts.address>=IP_HARD_LIMIT;
    return {
      captchaRequired:required,
      captchaAvailable:this.keysConfigured,
      siteKey:required&&this.keysConfigured?process.env.TURNSTILE_SITE_KEY:null,
      retryAfterSeconds:blocked?WINDOW_MINUTES*60:required&&!this.keysConfigured?WINDOW_MINUTES*60:0,
    };
  }

  async requireChallenge(email:string,token:string|undefined,context?:Context) {
    const status=await this.status(email,context);
    if(status.retryAfterSeconds) {
      throw new HttpException({
        message:'Too many login attempts. Try again in 15 minutes.',
        captchaRequired:status.captchaRequired,
      },429);
    }
    if(!status.captchaRequired)return;
    if(!token)throw new HttpException({
      message:'Complete the security verification to continue.',
      captchaRequired:true,
    },403);
    const valid=await this.verifyTurnstile(token,context?.ip);
    if(!valid)throw new HttpException({
      message:'Security verification failed or expired. Please try again.',
      captchaRequired:true,
    },403);
  }

  async recordFailure(email:string,context?:Context) {
    const keys=Object.values(this.keys(email,context));
    // A single SQL statement increments counters atomically across replicas.
    await this.db.query(`INSERT INTO auth_login_attempt_windows
      (lookup_hash,failed_count,window_started_at,last_failed_at)
      SELECT unnest($1::char(64)[]),1,now(),now()
      ON CONFLICT(lookup_hash) DO UPDATE SET
        failed_count=CASE WHEN auth_login_attempt_windows.last_failed_at<
          now()-interval '15 minutes' THEN 1
          ELSE auth_login_attempt_windows.failed_count+1 END,
        window_started_at=CASE WHEN auth_login_attempt_windows.last_failed_at<
          now()-interval '15 minutes' THEN now()
          ELSE auth_login_attempt_windows.window_started_at END,
        last_failed_at=now()`,[keys]);
  }

  async recordSuccess(email:string,context?:Context) {
    // Don't reset global IP counters: otherwise a successful account could
    // erase other failed attempts from a shared address.
    const keys=this.keys(email,context);
    await this.db.query(`DELETE FROM auth_login_attempt_windows
      WHERE lookup_hash=$1 OR lookup_hash=$2`,[keys.pair,keys.account]);
  }

  private async verifyTurnstile(token:string,ip?:string) {
    if(!this.keysConfigured||token.length>2048)return false;
    try {
      const params=new URLSearchParams({
        secret:process.env.TURNSTILE_SECRET_KEY!,
        response:token,
      });
      if(ip)params.set('remoteip',ip);
      const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:params,
        signal:AbortSignal.timeout(6000),
      });
      if(!response.ok)return false;
      const verdict=await response.json() as {success?:boolean;hostname?:string};
      const expectedHostname=process.env.TURNSTILE_EXPECTED_HOSTNAME?.trim().toLowerCase();
      return verdict.success===true &&
        (!expectedHostname||verdict.hostname?.toLowerCase()===expectedHostname);
    } catch(error) {
      this.logger.warn('CAPTCHA provider unreachable: '+(error instanceof Error?error.name:'error'));
      return false;
    }
  }
}
