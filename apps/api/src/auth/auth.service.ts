import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { LoginDto, RegisterDto } from './auth.dto';
import type { AuthTokenPayload } from './auth.types';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

type UserRow = { id: string; email: string; name: string; password_hash: string };
type MembershipRow = { id: string; organization_id: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rowCount) throw new ConflictException('Email already registered');

    const userId = randomUUID();
    const organizationId = randomUUID();
    const membershipId = randomUUID();
    const passwordHash = await hash(input.password, 12);

    await this.db.transaction(async (client) => {
      await client.query(
        'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
        [userId, email, input.name.trim(), passwordHash],
      );
      await client.query(
        'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
        [organizationId, input.organizationName.trim(), this.slug(input.organizationName, organizationId)],
      );
      await client.query(
        'INSERT INTO organization_memberships (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)',
        [membershipId, organizationId, userId, 'owner'],
      );
    });

    await this.subscriptions.createTrial(organizationId);

    return this.issueTokens({ id: userId, email, name: input.name.trim() }, { id: membershipId, organization_id: organizationId });
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

    const membershipResult = await this.db.query<MembershipRow>(
      'SELECT id, organization_id FROM organization_memberships WHERE user_id = $1 AND status = $2 ORDER BY created_at ASC LIMIT 1',
      [user.id, 'active'],
    );
    const membership = membershipResult.rows[0];
    if (!membership) throw new UnauthorizedException('No active organization membership');

    return this.issueTokens(user, membership);
  }

  private issueTokens(
    user: { id: string; email: string; name: string },
    membership: MembershipRow,
  ) {
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
      user: { id: user.id, email: user.email, name: user.name },
      organizationId: membership.organization_id,
    };
  }

  private slug(name: string, id: string) {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organization';
    return `${base}-${id.slice(0, 8)}`;
  }
}
