import { ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { GoogleAuthDto, LoginDto, RegisterDto } from './auth.dto';
import type { AuthTokenPayload } from './auth.types';
import { challengeHash, createMfaSecret, createRecoveryCodes, openMfaSecret, recoveryHash, sealMfaSecret, verifyTotp } from './admin-mfa.crypto';

type UserRow = { id: string; email: string; name: string; password_hash: string };
type MembershipRow = { id: string; organization_id: string };
type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  given_name?: string;
};
type GithubUserInfo = {
  id?: number;
  login?: string;
  name?: string | null;
};
type GithubEmail = {
  email?: string;
  primary?: boolean;
  verified?: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async providers() {
    const result = await this.db.query<any>(
      `SELECT provider, enabled, public_config
       FROM auth_provider_settings
       WHERE provider IN ('google','github')`,
    );
    const settings = new Map(result.rows.map((row:any) => [row.provider, row]));
    const google = settings.get('google') as any;
    const github = settings.get('github') as any;

    const googleClientId = String(google?.public_config?.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '').trim();
    const googleEnabled = google ? Boolean(google.enabled) : Boolean(googleClientId);

    const githubClientId = String(github?.public_config?.clientId ?? process.env.GITHUB_CLIENT_ID ?? '').trim();
    const githubSecretConfigured = Boolean(String(process.env.GITHUB_CLIENT_SECRET ?? '').trim());
    const githubEnabled = github
      ? Boolean(github.enabled)
      : Boolean(githubClientId && githubSecretConfigured);

    return {
      google: {
        enabled: googleEnabled && Boolean(googleClientId),
        clientId: googleEnabled ? googleClientId : '',
      },
      github: {
        enabled: githubEnabled && Boolean(githubClientId) && githubSecretConfigured,
        clientId: githubEnabled ? githubClientId : '',
      },
      email: {
        enabled: true,
      },
    };
  }

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rowCount) throw new ConflictException('Email already registered');

    const passwordHash = await hash(input.password, 12);
    const created = await this.createAccount({
      email,
      name: input.name.trim(),
      passwordHash,
      organizationName: input.organizationName?.trim(),
    });

    return this.issueTokens(created.user, created.membership);
  }

  async login(input: LoginDto, context?: { ip?: string; userAgent?: string }) {
    const email = input.email.trim().toLowerCase();
    const userResult = await this.db.query<UserRow & {is_platform_admin:boolean}>(
      'SELECT id, email, name, password_hash, is_platform_admin FROM users WHERE email = $1 AND disabled_at IS NULL LIMIT 1',
      [email],
    );
    const user = userResult.rows[0];
    if (!user || !(await compare(input.password, user.password_hash))) {
      if (user?.is_platform_admin) await this.recordPlatformLogin(user.id, 'failed', 'password', context);
      throw new UnauthorizedException('Invalid email or password');
    }

    const membership = await this.membership(user.id);
    return this.issueTokens(user, membership, 'password', context);
  }

  async google(input: GoogleAuthDto) {
    const profile = await this.verifyGoogleCredential(input.credential);
    const account = await this.socialAccount({
      provider: 'google',
      subject: profile.sub,
      email: String(profile.email),
      name: String(profile.name || profile.given_name || String(profile.email).split('@')[0]),
    });
    return this.issueTokens(account.user, account.membership, 'google');
  }

  async githubAuthorizeUrl(returnTo?: string) {
    const settings = await this.providers();
    const clientId = settings.github.clientId;
    if (!settings.github.enabled || !clientId) {
      throw new ServiceUnavailableException('GitHub sign-in is disabled or not configured');
    }

    const state = this.jwt.sign(
      {
        typ: 'github_oauth_state',
        returnTo: this.safeReturnTo(returnTo),
      },
      { expiresIn: 600 },
    );

    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', this.githubCallbackUrl());
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    url.searchParams.set('allow_signup', 'true');
    return url.toString();
  }

  async githubCallback(code?: string, state?: string, providerError?: string) {
    let returnTo = '/login';

    try {
      if (!state) throw new UnauthorizedException('Missing GitHub OAuth state');
      const statePayload = this.jwt.verify<{ typ?: string; returnTo?: string }>(state);
      if (statePayload.typ !== 'github_oauth_state') {
        throw new UnauthorizedException('Invalid GitHub OAuth state');
      }
      returnTo = this.safeReturnTo(statePayload.returnTo);

      if (providerError) {
        return this.githubFrontendRedirect(returnTo, { github_error: providerError });
      }
      if (!code) {
        return this.githubFrontendRedirect(returnTo, { github_error: 'missing_code' });
      }

      const profile = await this.verifyGithubCode(code);
      const account = await this.socialAccount({
        provider: 'github',
        subject: profile.subject,
        email: profile.email,
        name: profile.name,
      });

      const loginCode = randomBytes(32).toString('base64url');
      const codeHash = this.sha256(loginCode);

      await this.db.query(
        `DELETE FROM oauth_login_codes
         WHERE expires_at < now()
            OR (used_at IS NOT NULL AND used_at < now() - interval '1 day')`,
      );
      await this.db.query(
        `INSERT INTO oauth_login_codes
          (id, code_hash, provider, user_id, expires_at)
         VALUES ($1,$2,'github',$3,now() + interval '5 minutes')`,
        [randomUUID(), codeHash, account.user.id],
      );

      return this.githubFrontendRedirect(returnTo, { github_code: loginCode });
    } catch {
      return this.githubFrontendRedirect(returnTo, { github_error: 'oauth_failed' });
    }
  }

  async githubExchange(code: string) {
    const consumed = await this.db.query<{ user_id: string }>(
      `UPDATE oauth_login_codes
       SET used_at = now()
       WHERE code_hash = $1
         AND provider = 'github'
         AND used_at IS NULL
         AND expires_at > now()
       RETURNING user_id`,
      [this.sha256(code.trim())],
    );
    const userId = consumed.rows[0]?.user_id;
    if (!userId) throw new UnauthorizedException('GitHub login code is invalid or expired');

    const userResult = await this.db.query<UserRow>(
      'SELECT id, email, name, password_hash FROM users WHERE id = $1 AND disabled_at IS NULL LIMIT 1',
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) throw new UnauthorizedException('GitHub account is no longer available');

    const membership = await this.membership(user.id);
    return this.issueTokens(user, membership, 'github');
  }

  private async socialAccount(input: {
    provider: 'google' | 'github';
    subject: string;
    email: string;
    name: string;
  }) {
    const identity = await this.db.query<UserRow & MembershipRow & { membership_id: string }>(
      `SELECT u.id, u.email, u.name, u.password_hash, m.id AS membership_id,
              m.organization_id
       FROM user_auth_identities i
       JOIN users u ON u.id = i.user_id AND u.disabled_at IS NULL
       JOIN organization_memberships m ON m.user_id = u.id AND m.status = 'active'
       WHERE i.provider = $1 AND i.provider_subject = $2
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [input.provider, input.subject],
    );

    if (identity.rows[0]) {
      const row = identity.rows[0];
      return {
        user: { id: row.id, email: row.email, name: row.name, password_hash: row.password_hash },
        membership: { id: row.membership_id, organization_id: row.organization_id },
      };
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.db.query<UserRow>(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1 AND disabled_at IS NULL LIMIT 1',
      [email],
    );

    let user: UserRow;
    let membership: MembershipRow;

    if (existing.rows[0]) {
      user = existing.rows[0];
      membership = await this.membership(user.id);
    } else {
      const generatedPasswordHash = await hash(randomBytes(48).toString('base64url'), 12);
      const created = await this.createAccount({
        email,
        name: input.name.trim() || email.split('@')[0],
        passwordHash: generatedPasswordHash,
      });
      user = created.user;
      membership = created.membership;
    }

    await this.db.query(
      `INSERT INTO user_auth_identities
        (id, user_id, provider, provider_subject, provider_email)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, provider)
       DO UPDATE SET provider_subject = EXCLUDED.provider_subject,
                     provider_email = EXCLUDED.provider_email,
                     updated_at = now()`,
      [randomUUID(), user.id, input.provider, input.subject, email],
    );

    return { user, membership };
  }

  private async createAccount(input: {
    email: string;
    name: string;
    passwordHash: string;
    organizationName?: string;
  }) {
    const userId = randomUUID();
    const organizationId = randomUUID();
    const membershipId = randomUUID();
    const organizationName = input.organizationName || `${input.name}'s Workspace`;

    await this.db.transaction(async (client) => {
      await client.query(
        'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
        [userId, input.email, input.name, input.passwordHash],
      );
      await client.query(
        'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
        [organizationId, organizationName, this.slug(organizationName, organizationId)],
      );
      await client.query(
        'INSERT INTO organization_memberships (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)',
        [membershipId, organizationId, userId, 'owner'],
      );
      const trialDays = Number(process.env.TRIAL_DAYS ?? 7);
      await client.query(
        `INSERT INTO organization_subscriptions
         (organization_id, plan_code, status, current_period_start, current_period_end, trial_ends_at)
         VALUES ($1, 'trial', 'trialing', now(), now() + ($2 * interval '1 day'), now() + ($2 * interval '1 day'))`,
        [organizationId, trialDays],
      );
    });

    return {
      user: { id: userId, email: input.email, name: input.name, password_hash: input.passwordHash },
      membership: { id: membershipId, organization_id: organizationId },
    };
  }

  async profile(userId: string) {
    const result = await this.db.query<{id:string;name:string;email:string}>(
      'SELECT id, name, email FROM users WHERE id=$1', [userId]);
    return result.rows[0] ?? null;
  }

  private async membership(userId: string) {
    const membershipResult = await this.db.query<MembershipRow>(
      `SELECT m.id, m.organization_id FROM organization_memberships m
       JOIN organizations o ON o.id = m.organization_id AND o.suspended_at IS NULL
       WHERE m.user_id = $1 AND m.status = $2 ORDER BY m.created_at ASC LIMIT 1`,
      [userId, 'active'],
    );
    const membership = membershipResult.rows[0];
    if (!membership) throw new UnauthorizedException('No active organization membership');
    return membership;
  }

  private async issueTokens(
    user: { id: string; email: string; name: string },
    membership: MembershipRow,
    loginMethod: 'password' | 'google' | 'github' | 'register' = 'register',
    context?: { ip?: string; userAgent?: string },
    mfaVerified = false,
  ) {
    const onboarding = await this.db.query<{ onboarding_step: string }>(
      'SELECT onboarding_step FROM organizations WHERE id = $1 AND suspended_at IS NULL LIMIT 1',
      [membership.organization_id],
    );
    if (!onboarding.rows[0]) throw new UnauthorizedException('Organization access is suspended');
    const onboardingStep = onboarding.rows[0].onboarding_step ?? 'complete';
    const result = await this.db.query<{
      is_platform_admin: boolean; mfa_enabled_at: Date | null; token_version: number;
    }>(
      'SELECT is_platform_admin, mfa_enabled_at, token_version FROM users WHERE id = $1 AND disabled_at IS NULL LIMIT 1',
      [user.id],
    );
    const account = result.rows[0];
    if (!account) throw new UnauthorizedException('User account unavailable');
    const isPlatformAdmin = Boolean(account.is_platform_admin);

    if (isPlatformAdmin && account.mfa_enabled_at && !mfaVerified) {
      const challengeToken = randomBytes(32).toString('base64url');
      await this.db.query(`INSERT INTO platform_mfa_challenges
        (id, user_id, membership_id, token_hash, login_method, ip_address, user_agent, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes')`,
        [randomUUID(),user.id,membership.id,challengeHash(challengeToken),loginMethod,
         context?.ip?.slice(0,64)??null,context?.userAgent?.slice(0,256)??null]);
      return { mfaRequired: true, mfaTicket: challengeToken, isPlatformAdmin: true,
        nextPath: '/platform/mfa' };
    }

    const sessionId = randomUUID();
    const expiresIn = Number(process.env.JWT_EXPIRES_SECONDS ?? 3600);
    await this.db.query(`INSERT INTO user_login_sessions
      (id,user_id,organization_id,login_method,ip_address,user_agent,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,now()+($7::int*interval '1 second'))`,
      [sessionId,user.id,membership.organization_id,loginMethod,
       context?.ip?.slice(0,64)??null,context?.userAgent?.slice(0,256)??null,expiresIn]);
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      org: membership.organization_id,
      membership: membership.id,
      sid: sessionId,
      ver: account.token_version,
    };
    if (isPlatformAdmin) await this.recordPlatformLogin(user.id, 'success', loginMethod, context);
    return {
      accessToken: this.jwt.sign(payload),
      tokenType: 'Bearer',
      expiresIn,
      user: { id: user.id, email: user.email, name: user.name, isPlatformAdmin },
      organizationId: membership.organization_id,
      onboardingStep,
      isPlatformAdmin,
      nextPath: isPlatformAdmin ? '/platform' : loginMethod === 'register' && onboardingStep !== 'complete' ? '/onboarding' : '/dashboard',
    };
  }

  async mfaStatus(userId: string) {
    const result = await this.db.query<{ mfa_enabled_at: Date|null }>(
      'SELECT mfa_enabled_at FROM users WHERE id=$1 AND is_platform_admin=true AND disabled_at IS NULL',[userId]);
    if (!result.rows[0]) throw new UnauthorizedException('Administrator required');
    return { enabled: Boolean(result.rows[0].mfa_enabled_at) };
  }

  async beginMfaSetup(userId: string) {
    const current = await this.mfaStatus(userId);
    if (current.enabled) throw new ConflictException('Authenticator MFA is already enabled');
    const secret = createMfaSecret();
    await this.db.query(`UPDATE users SET mfa_pending_ciphertext=$2 WHERE id=$1 AND mfa_enabled_at IS NULL`,
      [userId,sealMfaSecret(secret)]);
    const email = await this.db.query<{email:string}>('SELECT email FROM users WHERE id=$1',[userId]);
    const issuer='RelayWA';
    const label=encodeURIComponent(issuer+':'+email.rows[0].email);
    return { secret, otpauthUrl:'otpauth://totp/'+label+'?secret='+secret+'&issuer='+encodeURIComponent(issuer)+'&algorithm=SHA1&digits=6&period=30' };
  }

  async confirmMfaSetup(userId: string, code: string) {
    return this.db.transaction(async(client)=>{
      const result=await client.query<{ mfa_pending_ciphertext:string|null; mfa_enabled_at:Date|null }>(
        'SELECT mfa_pending_ciphertext,mfa_enabled_at FROM users WHERE id=$1 AND is_platform_admin=true FOR UPDATE',[userId]);
      const account=result.rows[0];
      if(!account||account.mfa_enabled_at||!account.mfa_pending_ciphertext) {
        throw new ConflictException('No pending authenticator enrollment');
      }
      if(!verifyTotp(openMfaSecret(account.mfa_pending_ciphertext),code)) {
        throw new UnauthorizedException('Invalid authenticator code');
      }
      const recoveryCodes=createRecoveryCodes();
      await client.query(`UPDATE users SET mfa_secret_ciphertext=mfa_pending_ciphertext,
        mfa_pending_ciphertext=NULL,mfa_enabled_at=now(),mfa_recovery_hashes=$2::jsonb,
        token_version=token_version+1 WHERE id=$1`,
        [userId,JSON.stringify(recoveryCodes.map(recoveryHash))]);
      await client.query('UPDATE user_login_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
      return { enabled:true, recoveryCodes, requiresNewLogin:true };
    });
  }

  async verifyMfaChallenge(ticket: string, code: string) {
    const verdict = await this.db.transaction(async(client)=>{
      const challenges=await client.query<{
        id:string; user_id:string; membership_id:string; login_method:'password'|'google'|'github';
        ip_address:string|null;user_agent:string|null;expires_at:Date;attempts:number;used_at:Date|null;
      }>(`SELECT * FROM platform_mfa_challenges WHERE token_hash=$1 FOR UPDATE`,[challengeHash(ticket)]);
      const challenge=challenges.rows[0];
      if(!challenge||challenge.used_at||new Date(challenge.expires_at).getTime()<=Date.now()||challenge.attempts>=5){
        return {ok:false as const};
      }
      const users=await client.query<{
        id:string; email:string;name:string;mfa_secret_ciphertext:string|null;
        mfa_recovery_hashes:string[]|null;
      }>(`SELECT id,email,name,mfa_secret_ciphertext,mfa_recovery_hashes
         FROM users WHERE id=$1 AND is_platform_admin=true AND disabled_at IS NULL FOR UPDATE`,[challenge.user_id]);
      const user=users.rows[0];
      if(!user?.mfa_secret_ciphertext) return {ok:false as const};
      const matchesTotp=verifyTotp(openMfaSecret(user.mfa_secret_ciphertext),code);
      const hashed=recoveryHash(code);
      const backupHashes=Array.isArray(user.mfa_recovery_hashes)?user.mfa_recovery_hashes:[];
      const isRecovery=backupHashes.includes(hashed);
      await client.query('UPDATE platform_mfa_challenges SET attempts=attempts+1 WHERE id=$1',[challenge.id]);
      if(!matchesTotp&&!isRecovery) return {ok:false as const};
      if(isRecovery){
        await client.query('UPDATE users SET mfa_recovery_hashes=$2::jsonb WHERE id=$1',
          [user.id,JSON.stringify(backupHashes.filter(v=>v!==hashed))]);
      }
      await client.query('UPDATE platform_mfa_challenges SET used_at=now() WHERE id=$1',[challenge.id]);
      const membership=await client.query<MembershipRow>(`SELECT m.id,m.organization_id FROM organization_memberships m
        JOIN organizations o ON o.id=m.organization_id AND o.suspended_at IS NULL
        WHERE m.id=$1 AND m.user_id=$2 AND m.status='active' LIMIT 1`,[challenge.membership_id,user.id]);
      if(!membership.rows[0]) return {ok:false as const};
      return {ok:true as const,user,membership:membership.rows[0],method:challenge.login_method,
        context:{ip:challenge.ip_address??undefined,userAgent:challenge.user_agent??undefined}};
    });
    if(!verdict.ok) throw new UnauthorizedException('Invalid or expired MFA verification');
    return this.issueTokens(verdict.user,verdict.membership,verdict.method,verdict.context,true);
  }

  async userSessions(userId:string) {
    const result=await this.db.query(`SELECT id,login_method,ip_address,user_agent,created_at,
      expires_at,revoked_at FROM user_login_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40`,[userId]);
    return result.rows;
  }

  async revokeSession(userId:string, sessionId:string){
    const result=await this.db.query(`UPDATE user_login_sessions SET revoked_at=now()
      WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id`,[sessionId,userId]);
    return { revoked:result.rowCount>0 };
  }

  async revokeAllSessions(userId:string){
    await this.db.transaction(async(client)=>{
      await client.query('UPDATE users SET token_version=token_version+1 WHERE id=$1',[userId]);
      await client.query('UPDATE user_login_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
    });
    return {revoked:true,requiresNewLogin:true};
  }

  private async recordPlatformLogin(
    userId: string, outcome: 'success'|'failed', method: string,
    context?: { ip?: string; userAgent?: string },
  ) {
    await this.db.query(`INSERT INTO platform_login_events
      (id,user_id,outcome,login_method,ip_address,user_agent)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(),userId,outcome,method,
        context?.ip?.slice(0,64) ?? null, context?.userAgent?.slice(0,256) ?? null]);
  }

  private async verifyGoogleCredential(credential: string) {
    const settings = await this.providers();
    const clientId = settings.google.clientId;
    if (!settings.google.enabled || !clientId) {
      throw new ServiceUnavailableException('Google sign-in is disabled or not configured');
    }

    let response: Response;
    try {
      response = await fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
        { signal: AbortSignal.timeout(7000) },
      );
    } catch {
      throw new ServiceUnavailableException('Google identity verification is temporarily unavailable');
    }

    if (!response.ok) throw new UnauthorizedException('Invalid Google credential');
    const profile = await response.json() as GoogleTokenInfo;

    if (
      profile.aud !== clientId ||
      !profile.sub ||
      !profile.email ||
      profile.email_verified !== 'true'
    ) {
      throw new UnauthorizedException('Google identity could not be verified');
    }

    return profile as Required<Pick<GoogleTokenInfo,'sub'|'email'>> & GoogleTokenInfo;
  }

  private async verifyGithubCode(code: string) {
    const settings = await this.providers();
    const clientId = settings.github.clientId;
    const clientSecret = String(process.env.GITHUB_CLIENT_SECRET ?? '').trim();
    if (!settings.github.enabled || !clientId || !clientSecret) {
      throw new ServiceUnavailableException('GitHub sign-in is disabled or not configured');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'RelayWA',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: this.githubCallbackUrl(),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenResponse.ok) throw new UnauthorizedException('GitHub authorization failed');

    const tokenPayload = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenPayload.access_token || tokenPayload.error) {
      throw new UnauthorizedException('GitHub authorization failed');
    }

    const githubHeaders = {
      authorization: `Bearer ${tokenPayload.access_token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'RelayWA',
      'x-github-api-version': '2022-11-28',
    };
    const [profileResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: githubHeaders,
        signal: AbortSignal.timeout(8000),
      }),
      fetch('https://api.github.com/user/emails', {
        headers: githubHeaders,
        signal: AbortSignal.timeout(8000),
      }),
    ]);
    if (!profileResponse.ok || !emailsResponse.ok) {
      throw new UnauthorizedException('Unable to verify GitHub identity');
    }

    const profile = await profileResponse.json() as GithubUserInfo;
    const emails = await emailsResponse.json() as GithubEmail[];
    const selected = emails.find((item) => item.primary && item.verified)
      ?? emails.find((item) => item.verified);

    if (!profile.id || !selected?.email) {
      throw new UnauthorizedException('GitHub account does not have a verified email address');
    }

    return {
      subject: String(profile.id),
      email: selected.email.trim().toLowerCase(),
      name: String(profile.name || profile.login || selected.email.split('@')[0]),
    };
  }

  private githubCallbackUrl() {
    const explicit = String(process.env.GITHUB_CALLBACK_URL ?? '').trim();
    if (explicit) return explicit;
    const site = String(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return `${site}/api/auth/github/callback`;
  }

  private githubFrontendRedirect(returnTo: string, params: Record<string, string>) {
    const base = String(
      process.env.AUTH_FRONTEND_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000',
    ).replace(/\/$/, '');
    const url = new URL(this.safeReturnTo(returnTo), base + '/');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }

  private safeReturnTo(value?: string) {
    const candidate = String(value ?? '/login');
    if (/^\/(login|register)(?:\?|$)/.test(candidate)) return candidate;
    return '/login';
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private slug(name: string, id: string) {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organization';
    return `${base}-${id.slice(0, 8)}`;
  }
}
