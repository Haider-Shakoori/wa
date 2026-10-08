import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PlatformSupportQuestionDto, UpdateGithubAuthProviderDto, UpdateGoogleAuthProviderDto, UpdateMessagingEngineDto, UpdateMessagingSafetyDto, UpdatePlatformSubscriptionDto, UpdateTenantMemberStatusDto } from './platform-admin.dto';
import { type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Controller(['platform', 'v1/platform'])
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platform: PlatformAdminService) {}

  @Get('overview')
  overview() { return this.platform.overview(); }

  @Get('analytics')
  analytics() { return this.platform.analytics(); }

  @Get('audit-logs')
  auditLogs() { return this.platform.auditLogs(); }

  @Get('tenants')
  tenants() { return this.platform.tenants(); }

  @Get('tenants/:organizationId/members')
  tenantMembers(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.platform.tenantMembers(organizationId);
  }

  @Patch('tenants/:organizationId/members/:membershipId/status')
  updateTenantMemberStatus(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() body: UpdateTenantMemberStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.platform.updateTenantMemberStatus(organizationId, membershipId, body, request.auth.sub);
  }

  @Get('sessions')
  sessions() { return this.platform.sessions(); }

  @Get('subscriptions')
  subscriptions() { return this.platform.subscriptions(); }

  @Patch('sessions/:sessionId/engine')
  updateSessionEngine(
    @Param('sessionId') sessionId: string,
    @Body() body: UpdateMessagingEngineDto,
  ) {
    return this.platform.updateSessionEngine(sessionId, body);
  }

  @Post('sessions/:sessionId/connect')
  connectSession(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Req() request: AuthenticatedRequest) {
    return this.platform.sessionAction(sessionId, 'connect', request.auth.sub);
  }

  @Post('sessions/:sessionId/restart')
  restartSession(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Req() request: AuthenticatedRequest) {
    return this.platform.sessionAction(sessionId, 'restart', request.auth.sub);
  }

  @Post('sessions/:sessionId/logout')
  logoutSession(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Req() request: AuthenticatedRequest) {
    return this.platform.sessionAction(sessionId, 'logout', request.auth.sub);
  }

  @Post('sessions/:sessionId/messaging/resume')
  resumeSessionMessaging(@Param('sessionId') sessionId: string) {
    return this.platform.resumeSessionMessaging(sessionId);
  }

  @Patch('subscriptions/:organizationId')
  updateSubscription(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdatePlatformSubscriptionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.platform.updateSubscription(organizationId, body, request.auth.sub);
  }

  @Get('settings/auth-providers')
  authProviders() { return this.platform.authProviders(); }

  @Patch('settings/auth-providers/google')
  updateGoogleAuthProvider(@Body() body: UpdateGoogleAuthProviderDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateGoogleAuthProvider(body, request.auth.sub);
  }

  @Patch('settings/auth-providers/github')
  updateGithubAuthProvider(@Body() body: UpdateGithubAuthProviderDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateGithubAuthProvider(body, request.auth.sub);
  }

  @Get('settings/messaging-engine')
  messagingEngineSettings() { return this.platform.messagingEngineSettings(); }

  @Patch('settings/messaging-engine')
  updateMessagingEngine(@Body() body: UpdateMessagingEngineDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateMessagingEngine(body, request.auth.sub);
  }

  @Get('settings/messaging-safety')
  messagingSafetySettings() { return this.platform.messagingSafetySettings(); }

  @Patch('settings/messaging-safety')
  updateMessagingSafety(@Body() body: UpdateMessagingSafetyDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateMessagingSafety(body, request.auth.sub);
  }

  @Get('workers')
  workers() { return this.platform.workers(); }

  @Get('queues')
  queues() { return this.platform.queues(); }

  @Get('payments')
  payments() { return this.platform.payments(); }

  @Get('errors')
  errors() { return this.platform.recentErrors(); }

  @Post('support/ask')
  supportAsk(@Body() body: PlatformSupportQuestionDto) {
    return this.platform.supportAnswer(body.message);
  }
}
