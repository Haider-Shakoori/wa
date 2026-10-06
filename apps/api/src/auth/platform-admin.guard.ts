import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { type AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const result = await this.db.query<{ is_platform_admin: boolean }>(
      'SELECT is_platform_admin FROM users WHERE id = $1 AND disabled_at IS NULL LIMIT 1',
      [request.auth.sub],
    );

    if (!result.rows[0]?.is_platform_admin) {
      throw new ForbiddenException('Platform administrator access required');
    }

    return true;
  }
}
