import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import type { Request } from 'express';
import type { AuthTokenPayload } from './auth.types';

export type AuthenticatedRequest = Request & { auth: AuthTokenPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    try {
      request.auth = await this.jwt.verifyAsync<AuthTokenPayload>(header.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    // A previously issued JWT must not retain access after membership suspension.
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
