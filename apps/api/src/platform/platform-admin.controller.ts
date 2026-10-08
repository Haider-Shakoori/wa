import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformSupportQuestionDto, UpdateGithubAuthProviderDto, UpdateGoogleAuthProviderDto, UpdateMessagingEngineDto, UpdateMessagingSafetyDto, UpdatePlatformSubscriptionDto, UpdateTenantMemberStatusDto, UpdateTenantSuspensionDto, UpdatePlatformAdminRoleDto, UpdateAlertAcknowledgementDto } from './platform-admin.dto';
import { type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PlatformRoles } from '../auth/platform-roles.decorator';
import { PlatformAdminService } from './platform-admin.service';
import { WebsiteAnalyticsService } from '../website-analytics/website-analytics.service';
import { GoogleAnalyticsReportingService } from './google-analytics-reporting.service';

@Controller(['platform', 'v1/platform'])
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platform: PlatformAdminService,
    private readonly websiteTraffic: WebsiteAnalyticsService,
    private readonly googleAnalytics: GoogleAnalyticsReportingService) {}

  @Get('whoami')
  whoami(@Req() request: AuthenticatedRequest) {
    return this.platform.whoami(request.auth.sub);
  }

  @Get('overview')
  overview() { return this.platform.overview(); }

  @Get('analytics')
  analytics() { return this.platform.analytics(); }

  @Get('website-traffic')
  websiteTrafficReport(@Query('days') days?: string) {
    return this.websiteTraffic.report(days);
  }

  @Get('google-analytics')
  googleAnalyticsReport(@Query('days') days?: string) {
    return this.googleAnalytics.report(days);
  }

  @Get('monitoring/overview')
  monitoringOverview() { return this.platform.monitoringOverview(); }

  @Get('monitoring/alerts')
  monitoringAlerts(@Query('severity') severity?: string,@Query('acknowledgement') acknowledgement?: string) {
    return this.platform.monitoringAlerts(severity,acknowledgement);
  }

  @Patch('monitoring/alerts/:alertId/acknowledgement')
  @PlatformRoles('super_admin','support_admin')
  acknowledgeAlert(@Param('alertId',ParseUUIDPipe) alertId:string,
    @Body() body:UpdateAlertAcknowledgementDto,@Req() request:AuthenticatedRequest) {
    return this.platform.setAlertAcknowledgement(alertId,body.acknowledged,request.auth.sub);
  }

  @Get('audit-logs')
  auditLogs(@Query('action') action?: string, @Query('actor') actor?: string) {
    return this.platform.auditLogs(action, actor);
  }

  @Get('security/login-events')
  @PlatformRoles('super_admin','support_admin')
  loginEvents() { return this.platform.loginEvents(); }

  @Get('administrators')
  @PlatformRoles('super_admin')
  administrators() { return this.platform.administrators(); }

  @Patch('administrators/:userId/role')
  @PlatformRoles('super_admin')
  updateAdminRole(@Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdatePlatformAdminRoleDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateAdminRole(userId, body, request.auth.sub);
  }

  @Get('tenants')
  tenants() { return this.platform.tenants(); }

  @Patch('tenants/:organizationId/suspension')
  @PlatformRoles('super_admin')
  setTenantSuspension(@Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: UpdateTenantSuspensionDto, @Req() request: AuthenticatedRequest) {
    return this.platform.setTenantSuspension(organizationId, body, request.auth.sub);
  }

  @Get('tenants/:organizationId/members')
  tenantMembers(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.platform.tenantMembers(organizationId);
  }

  @Patch('tenants/:organizationId/members/:membershipId/status')
  @PlatformRoles('super_admin','support_admin')
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
  @PlatformRoles('super_admin','support_admin')
  updateSessionEngine(
    @Param('sessionId') sessionId: string,
    @Body() body: UpdateMessagingEngineDto,
  ) {
    return this.platform.updateSessionEngine(sessionId, body);
  }

  @Post('sessions/:sessionId/connect')
  @PlatformRoles('super_admin','support_admin')
  connectSession(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Req() request: AuthenticatedRequest) {
    return this.platform.sessionAction(sessionId, 'connect', request.auth.sub);
  }

  @Post('sessions/:sessionId/restart')
  @PlatformRoles('super_admin','support_admin')
  restartSession(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Req() request: AuthenticatedRequest) {
    return this.platform.sessionAction(sessionId, 'restart', request.auth.sub);
  }

  @Post('sessions/:sessionId/logout')
  @PlatformRoles('super_admin','support_admin')
  logoutSession(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Req() request: AuthenticatedRequest) {
    return this.platform.sessionAction(sessionId, 'logout', request.auth.sub);
  }

  @Post('sessions/:sessionId/messaging/resume')
  @PlatformRoles('super_admin','support_admin')
  resumeSessionMessaging(@Param('sessionId') sessionId: string) {
    return this.platform.resumeSessionMessaging(sessionId);
  }

  @Patch('subscriptions/:organizationId')
  @PlatformRoles('super_admin','billing_admin')
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
  @PlatformRoles('super_admin')
  updateGoogleAuthProvider(@Body() body: UpdateGoogleAuthProviderDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateGoogleAuthProvider(body, request.auth.sub);
  }

  @Patch('settings/auth-providers/github')
  @PlatformRoles('super_admin')
  updateGithubAuthProvider(@Body() body: UpdateGithubAuthProviderDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateGithubAuthProvider(body, request.auth.sub);
  }

  @Get('settings/messaging-engine')
  messagingEngineSettings() { return this.platform.messagingEngineSettings(); }

  @Patch('settings/messaging-engine')
  @PlatformRoles('super_admin')
  updateMessagingEngine(@Body() body: UpdateMessagingEngineDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateMessagingEngine(body, request.auth.sub);
  }

  @Get('settings/messaging-safety')
  messagingSafetySettings() { return this.platform.messagingSafetySettings(); }

  @Patch('settings/messaging-safety')
  @PlatformRoles('super_admin')
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
