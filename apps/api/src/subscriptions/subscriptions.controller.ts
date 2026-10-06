import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('v1/billing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  plans() {
    return this.subscriptions.listPlans();
  }

  @Get('subscription')
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  summary(@Req() request: AuthenticatedRequest) {
    return this.subscriptions.summary(request.auth.org);
  }
}
