import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { QrService } from './qr.service';
import { CreateSessionDto } from './sessions.dto';
import { SessionsService } from './sessions.service';

@Controller('v1/sessions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly qr: QrService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  list(@Req() request: AuthenticatedRequest) {
    return this.sessions.list(request.auth.org);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateSessionDto) {
    return this.sessions.create(request.auth.org, request.auth.sub, body);
  }

  @Get(':sessionId/qr')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  getQr(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.qr.get(request.auth.org, sessionId);
  }

  @Get(':sessionId')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  get(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.get(request.auth.org, sessionId);
  }

  @Post(':sessionId/connect')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  connect(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.requestLifecycle(request.auth.org, sessionId, 'connect');
  }

  @Post(':sessionId/restart')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  restart(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.requestLifecycle(request.auth.org, sessionId, 'restart');
  }

  @Post(':sessionId/logout')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  logout(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.requestLifecycle(request.auth.org, sessionId, 'logout');
  }
}
