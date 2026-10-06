import { Body, Controller, Get, Param, Post, Req, Sse, UseGuards } from '@nestjs/common';
import { ApiAccessGuard, type ApiAuthenticatedRequest } from '../auth/api-access.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { QrService } from './qr.service';
import { CreateSessionDto } from './sessions.dto';
import { SessionsService } from './sessions.service';
import { EventsService } from './events.service';

@Controller('v1/sessions')
@UseGuards(ApiAccessGuard, PermissionGuard)
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly qr: QrService,
    private readonly events: EventsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  list(@Req() request: ApiAuthenticatedRequest) {
    return this.sessions.list(request.auth.org);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  create(@Req() request: ApiAuthenticatedRequest, @Body() body: CreateSessionDto) {
    return this.sessions.create(request.auth.org, request.auth.sub, body);
  }

  @Sse(':sessionId/events')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  streamEvents(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.events.stream(request.auth.org, sessionId);
  }

  @Get(':sessionId/qr')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  getQr(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.qr.get(request.auth.org, sessionId);
  }

  @Get(':sessionId')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  get(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.get(request.auth.org, sessionId);
  }

  @Post(':sessionId/connect')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  connect(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.requestLifecycle(request.auth.org, sessionId, 'connect');
  }

  @Post(':sessionId/restart')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  restart(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.requestLifecycle(request.auth.org, sessionId, 'restart');
  }

  @Post(':sessionId/logout')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  logout(@Req() request: ApiAuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.sessions.requestLifecycle(request.auth.org, sessionId, 'logout');
  }
}
