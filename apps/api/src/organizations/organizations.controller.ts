import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';

@Controller(['organizations', 'v1/organizations'])
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly db: DatabaseService) {}

  @Get('current')
  async current(@Req() request: AuthenticatedRequest) {
    const result = await this.db.query(
      `SELECT o.id, o.name, o.slug, m.role, m.status
       FROM organizations o
       JOIN organization_memberships m ON m.organization_id = o.id
       WHERE o.id = $1 AND m.user_id = $2 AND m.id = $3
       LIMIT 1`,
      [request.auth.org, request.auth.sub, request.auth.membership],
    );
    return result.rows[0] ?? null;
  }
}
