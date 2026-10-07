import { ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { GoogleAuthDto, LoginDto, RegisterDto } from './auth.dto';
import type { AuthTokenPayload } from './auth.types';

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

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async providers() {
    const result = await this.db.query<any>(
      `SELECT enabled, public_config
       FROM auth_provider_settings
       WHERE provider = 'google'
       LIMIT 1`,
    );
    const row = result.rows[0];
    const clientId = String(row?.public_config?.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '').trim();
    const enabled = row ? Boolean(row.enabled) : Boolean(clientId);

    return {
      google: {
        enabled: enabled && Boolean(clientId),
        clientId: enabled ? clientId : '',
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

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const userResult = await this.db.query<UserRow>(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1 AND disabled_at IS NULL LIMIT 1',
      [email],
    );
    const user = userResult.rows[0];
    if (!user || !(await compare(input.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const membership = await this.membership(user.id);
    return this.issueTokens(user, membership);
  }

  async google(input: GoogleAuthDto) {
    const profile = await this.verifyGoogleCredential(input.credential);

    const identity = await this.db.query<UserRow & MembershipRow>(
      `SELECT u.id, u.email, u.name, u.password_hash, m.id AS membership_id,
              m.organization_id
       FROM user_auth_identities i
       JOIN users u ON u.id = i.user_id AND u.disabled_at IS NULL
       JOIN organization_memberships m ON m.user_id = u.id AND m.status = 'active'
       WHERE i.provider = 'google' AND i.provider_subject = $1
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [profile.sub],
    );

    if (identity.rows[0]) {
      const row:any = identity.rows[0];
      return this.issueTokens(
        { id: row.id, email: row.email, name: row.name },
        { id: row.membership_id, organization_id: row.organization_id },
      );
    }

    const email = String(profile.email).trim().toLowerCase();
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
        name: String(profile.name || profile.given_name || email.split('@')[0]),
        passwordHash: generatedPasswordHash,
      });
      user = created.user;
      membership = created.membership;
    }

    await this.db.query(
      `INSERT INTO user_auth_identities
        (id, user_id, provider, provider_subject, provider_email)
       VALUES ($1,$2,'google',$3,$4)
       ON CONFLICT (provider, provider_subject)
       DO UPDATE SET provider_email = EXCLUDED.provider_email, updated_at = now()`,
      [randomUUID(), user.id, profile.sub, email],
    );

    return this.issueTokens(user, membership);
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
    });

    return {
      user: { id: userId, email: input.email, name: input.name, password_hash: input.passwordHash },
      membership: { id: membershipId, organization_id: organizationId },
    };
  }

  private async membership(userId: string) {
    const membershipResult = await this.db.query<MembershipRow>(
      'SELECT id, organization_id FROM organization_memberships WHERE user_id = $1 AND status = $2 ORDER BY created_at ASC LIMIT 1',
      [userId, 'active'],
    );
    const membership = membershipResult.rows[0];
    if (!membership) throw new UnauthorizedException('No active organization membership');
    return membership;
  }

  private async issueTokens(
    user: { id: string; email: string; name: string },
    membership: MembershipRow,
  ) {
    const onboarding = await this.db.query<{ onboarding_step: string }>(
      'SELECT onboarding_step FROM organizations WHERE id = $1 LIMIT 1',
      [membership.organization_id],
    );
    const onboardingStep = onboarding.rows[0]?.onboarding_step ?? 'complete';
    const platformAdmin = await this.db.query<{ is_platform_admin: boolean }>(
      'SELECT is_platform_admin FROM users WHERE id = $1 AND disabled_at IS NULL LIMIT 1',
      [user.id],
    );
    const isPlatformAdmin = Boolean(platformAdmin.rows[0]?.is_platform_admin);

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      org: membership.organization_id,
      membership: membership.id,
    };

    return {
      accessToken: this.jwt.sign(payload),
      tokenType: 'Bearer',
      expiresIn: Number(process.env.JWT_EXPIRES_SECONDS ?? 3600),
      user: { id: user.id, email: user.email, name: user.name, isPlatformAdmin },
      organizationId: membership.organization_id,
      onboardingStep,
      isPlatformAdmin,
      nextPath: isPlatformAdmin ? '/platform' : onboardingStep === 'complete' ? '/dashboard' : '/onboarding',
    };
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

  private slug(name: string, id: string) {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organization';
    return `${base}-${id.slice(0, 8)}`;
  }
}
