import { Controller, Get, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';

@Controller('v1/platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly db: DatabaseService) {}

  @Get('overview')
  async overview() {
    const [users, organizations, activeMemberships] = await Promise.all([
      this.db.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM users WHERE disabled_at IS NULL',
      ),
      this.db.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM organizations',
      ),
      this.db.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM organization_memberships WHERE status = 'active'",
      ),
    ]);

    return {
      users: Number(users.rows[0]?.count ?? 0),
      organizations: Number(organizations.rows[0]?.count ?? 0),
      activeMemberships: Number(activeMemberships.rows[0]?.count ?? 0),
    };
  }
}
