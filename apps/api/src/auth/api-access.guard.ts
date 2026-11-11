import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { Request } from 'express';
import type { AuthTokenPayload } from './auth.types';

export type ApiAuth =
  | (AuthTokenPayload & { kind: 'user' })
  | {
      kind: 'api_key';
      sub: string;
      org: string;
      membership: string;
      apiKeyId: string;
      scopes: string[];
      sessionId: string | null;
      tokenType: 'organization' | 'session';
    };

export type ApiAuthenticatedRequest = Request & { auth: ApiAuth };

@Injectable()
export class ApiAccessGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiAuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');

    const token = header.slice(7);
    if (token.startsWith('rw_live_') || token.startsWith('rw_session_')) {
      const hash = createHash('sha256').update(token).digest('hex');
      const result = await this.db.query<{
        id: string;
        organization_id: string;
        session_id: string | null;
        scopes: string[];
        token_type: 'organization' | 'session';
        created_by_user_id: string;
      }>(
        `UPDATE api_keys
         SET last_used_at = now(), updated_at = now()
         WHERE key_hash = $1
           AND enabled = true
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > now())
           AND EXISTS (SELECT 1 FROM organizations o
             WHERE o.id = api_keys.organization_id AND o.suspended_at IS NULL)
         RETURNING id, organization_id, session_id, scopes, token_type, created_by_user_id`,
        [hash],
      );
      const key = result.rows[0];
      if (!key) throw new UnauthorizedException('Invalid, expired, or revoked API key');

      request.auth = {
        kind: 'api_key',
        sub: key.created_by_user_id,
        org: key.organization_id,
        membership: key.id,
        apiKeyId: key.id,
        scopes: key.scopes,
        sessionId: key.session_id,
        tokenType: key.token_type,
      };
      return true;
    }

    try {
      request.auth = {
        ...(await this.jwt.verifyAsync<AuthTokenPayload>(token)),
        kind: 'user',
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // User JWTs are revoked immediately when their tenant membership is suspended.
    // Tenant suspension invalidates existing user JWTs and organization API keys.
    const result = await this.db.query(
      `SELECT m.id FROM organization_memberships m
       JOIN users u ON u.id::text = m.user_id::text
       JOIN organizations o ON o.id::text = m.organization_id::text
       WHERE m.id::text = $1::text AND m.organization_id::text = $2::text AND m.user_id::text = $3::text
         AND m.status = 'active' AND u.disabled_at IS NULL
         AND o.suspended_at IS NULL
         AND u.token_version=COALESCE($4::int,0)
         AND ($5::text IS NULL OR EXISTS (SELECT 1 FROM user_login_sessions ls
           WHERE ls.id::text=$5::text AND ls.user_id::text=u.id::text AND ls.revoked_at IS NULL AND ls.expires_at::timestamptz>now()))
         LIMIT 1`,
      [request.auth.membership, request.auth.org, request.auth.sub,request.auth.ver??0,request.auth.sid??null],
    );
    if (!result.rowCount) throw new UnauthorizedException('Organization access is inactive');
    return true;
  }
}
