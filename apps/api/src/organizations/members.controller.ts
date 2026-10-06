import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { UpdateMemberRoleDto } from './members.dto';

@Controller('v1/organizations/current/members')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MembersController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MEMBERS_READ)
  async list(@Req() request: AuthenticatedRequest) {
    const result = await this.db.query(
      `SELECT m.id, m.role, m.status, m.created_at,
              u.id AS user_id, u.name, u.email
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1
       ORDER BY m.created_at ASC`,
      [request.auth.org],
    );
    return { data: result.rows };
  }

  @Patch(':membershipId/role')
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  async updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    const target = await this.db.query<{ role: string }>(
      'SELECT role FROM organization_memberships WHERE id = $1 AND organization_id = $2 LIMIT 1',
      [membershipId, request.auth.org],
    );
    if (!target.rows[0]) return { updated: false };

    if (target.rows[0].role === 'owner' || body.role === 'owner') {
      return { updated: false, reason: 'Owner role changes require ownership transfer workflow' };
    }

    const result = await this.db.query(
      `UPDATE organization_memberships
       SET role = $1, updated_at = now()
       WHERE id = $2 AND organization_id = $3
       RETURNING id, role, status, updated_at`,
      [body.role, membershipId, request.auth.org],
    );
    return { updated: true, membership: result.rows[0] };
  }
}
