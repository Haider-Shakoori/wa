import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database/database.service';
import { PERMISSION_TO_API_SCOPE } from '../api-keys/api-scope-map';
import { type ApiAuthenticatedRequest } from './api-access.guard';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator';
import { ROLE_PERMISSIONS, type OrganizationRole, type Permission } from './permissions';

type MembershipRoleRow = { role: OrganizationRole };

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<ApiAuthenticatedRequest>();
    if ('scopes' in request.auth && request.auth.kind === 'api_key') {
      const apiAuth = request.auth;
      const requiredScopes = required.map((permission) => PERMISSION_TO_API_SCOPE[permission]);
      if (requiredScopes.some((scope) => !scope)) {
        throw new ForbiddenException('This operation requires dashboard user authentication');
      }
      if (!requiredScopes.every((scope) => apiAuth.scopes.includes(scope!))) {
        throw new ForbiddenException('API key is missing a required scope');
      }

      if (apiAuth.sessionId) {
        const routeSessionId = request.params?.sessionId;
        if (!routeSessionId) {
          throw new ForbiddenException('Session token cannot access organization-wide resources');
        }
        if (routeSessionId !== apiAuth.sessionId) {
          throw new ForbiddenException('Session token is not valid for this session');
        }
      }
      return true;
    }

    const result = await this.db.query<MembershipRoleRow>(
      `SELECT role
       FROM organization_memberships
       WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND status = 'active'
       LIMIT 1`,
      [request.auth.membership, request.auth.org, request.auth.sub],
    );
    const membership = result.rows[0];
    if (!membership) throw new ForbiddenException('Inactive or invalid organization membership');

    const granted = ROLE_PERMISSIONS[membership.role] ?? [];
    if (!required.every((permission) => granted.includes(permission))) {
      throw new ForbiddenException('Insufficient organization permission');
    }
    return true;
  }
}
