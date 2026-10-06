import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiAccessGuard, type ApiApiAuthenticatedRequest } from '../auth/api-access.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { DirectoryService } from './directory.service';

@Controller('v1/sessions/:sessionId')
@UseGuards(ApiAccessGuard, PermissionGuard)
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('contacts')
  @RequirePermissions(PERMISSIONS.CONTACTS_READ)
  contacts(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.directory.contacts(request.auth.org, sessionId);
  }

  @Get('chats')
  @RequirePermissions(PERMISSIONS.CHATS_READ)
  chats(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.directory.chats(request.auth.org, sessionId);
  }

  @Get('groups')
  @RequirePermissions(PERMISSIONS.GROUPS_READ)
  groups(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.directory.groups(request.auth.org, sessionId);
  }
}
