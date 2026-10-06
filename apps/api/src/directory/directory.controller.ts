import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { DirectoryService } from './directory.service';

@Controller('v1/sessions/:sessionId')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('contacts')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  contacts(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.directory.contacts(request.auth.org, sessionId);
  }

  @Get('chats')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  chats(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.directory.chats(request.auth.org, sessionId);
  }

  @Get('groups')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  groups(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.directory.groups(request.auth.org, sessionId);
  }
}
