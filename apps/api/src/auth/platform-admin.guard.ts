import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database/database.service';
import { type AuthenticatedRequest } from './jwt-auth.guard';
import { PLATFORM_ROLES_KEY, type PlatformRole } from './platform-roles.decorator';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly db: DatabaseService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const result = await this.db.query<{ is_platform_admin: boolean; platform_role: string | null }>(
      'SELECT is_platform_admin, platform_role FROM users WHERE id = $1 AND disabled_at IS NULL LIMIT 1',
      [request.auth.sub],
    );
    const admin = result.rows[0];
    if (!admin?.is_platform_admin) {
      throw new ForbiddenException('Platform administrator access required');
    }
    const role = admin.platform_role as PlatformRole | null;
    const allowed: PlatformRole[] = ['super_admin','billing_admin','support_admin','read_only'];
    if (!role || !allowed.includes(role)) throw new ForbiddenException('Invalid platform administrator role');

    const required = this.reflector.getAllAndOverride<PlatformRole[]>(PLATFORM_ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (required?.length && !required.includes(role)) {
      throw new ForbiddenException('Insufficient platform administrator role');
    }
    return true;
  }
}
