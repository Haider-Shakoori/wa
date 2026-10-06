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
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
