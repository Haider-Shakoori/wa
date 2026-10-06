import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateWebhookDto, UpdateWebhookDto } from './webhooks.dto';
import { WebhooksService } from './webhooks.service';

@Controller('v1/webhooks')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions(PERMISSIONS.WEBHOOKS_MANAGE)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.webhooks.list(request.auth.org);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateWebhookDto) {
    return this.webhooks.create(request.auth.org, body);
  }

  @Patch(':endpointId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('endpointId') endpointId: string,
    @Body() body: UpdateWebhookDto,
  ) {
    return this.webhooks.update(request.auth.org, endpointId, body);
  }

  @Delete(':endpointId')
  remove(@Req() request: AuthenticatedRequest, @Param('endpointId') endpointId: string) {
    return this.webhooks.remove(request.auth.org, endpointId);
  }

  @Get(':endpointId/deliveries')
  deliveries(@Req() request: AuthenticatedRequest, @Param('endpointId') endpointId: string) {
    return this.webhooks.deliveries(request.auth.org, endpointId);
  }
}
