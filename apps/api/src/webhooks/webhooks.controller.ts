import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiAccessGuard, type ApiAuthenticatedRequest } from '../auth/api-access.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateWebhookDto, UpdateWebhookDto } from './webhooks.dto';
import { WebhooksService } from './webhooks.service';

@Controller(['webhooks', 'v1/webhooks'])
@UseGuards(ApiAccessGuard, PermissionGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WEBHOOKS_READ)
  list(@Req() request: ApiAuthenticatedRequest) {
    return this.webhooks.list(request.auth.org);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WEBHOOKS_MANAGE)
  create(@Req() request: ApiAuthenticatedRequest, @Body() body: CreateWebhookDto) {
    return this.webhooks.create(request.auth.org, body);
  }

  @Patch(':endpointId')
  @RequirePermissions(PERMISSIONS.WEBHOOKS_MANAGE)
  update(
    @Req() request: ApiAuthenticatedRequest,
    @Param('endpointId') endpointId: string,
    @Body() body: UpdateWebhookDto,
  ) {
    return this.webhooks.update(request.auth.org, endpointId, body);
  }

  @Delete(':endpointId')
  @RequirePermissions(PERMISSIONS.WEBHOOKS_MANAGE)
  remove(@Req() request: ApiAuthenticatedRequest, @Param('endpointId') endpointId: string) {
    return this.webhooks.remove(request.auth.org, endpointId);
  }

  @Get(':endpointId/deliveries')
  @RequirePermissions(PERMISSIONS.WEBHOOKS_READ)
  deliveries(@Req() request: ApiAuthenticatedRequest, @Param('endpointId') endpointId: string) {
    return this.webhooks.deliveries(request.auth.org, endpointId);
  }
}
