import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AddPlatformAdministratorDto, PlatformSupportQuestionDto, UpdateGithubAuthProviderDto, UpdateGoogleAuthProviderDto, UpdateMessagingEngineDto, UpdateMessagingSafetyDto, UpdateMessageHistoryStorageDto, UpdatePlatformSubscriptionDto, UpdateTenantMemberStatusDto, UpdateTenantSuspensionDto, UpdatePlatformAdminRoleDto, WebsitePlanDto, UpdateAlertAcknowledgementDto, UpdateAlertResolutionDto, ArchiveDiagnosticDto } from './platform-admin.dto';
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
  monitoringAlerts(@Query('severity') severity?: string,@Query('acknowledgement') acknowledgement?: string,@Query('lifecycle') lifecycle?: string) {
    return this.platform.monitoringAlerts(severity,acknowledgement,lifecycle);
  }

  @Patch('monitoring/alerts/:alertId/acknowledgement')
  @PlatformRoles('super_admin','support_admin')
  acknowledgeAlert(@Param('alertId',ParseUUIDPipe) alertId:string,
    @Body() body:UpdateAlertAcknowledgementDto,@Req() request:AuthenticatedRequest) {
    return this.platform.setAlertAcknowledgement(alertId,body.acknowledged,request.auth.sub);
  }

  @Patch('monitoring/alerts/:alertId/resolution')
  @PlatformRoles('super_admin','support_admin')
  resolveAlert(@Param('alertId',ParseUUIDPipe) alertId:string,
    @Body() body:UpdateAlertResolutionDto,@Req() request:AuthenticatedRequest) {
    return this.platform.setAlertResolution(alertId,body.resolved,body.reason,request.auth.sub);
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

  @Post('administrators')
  @PlatformRoles('super_admin')
  addAdministrator(@Body() body: AddPlatformAdministratorDto,
    @Req() request: AuthenticatedRequest) {
    return this.platform.addAdministrator(body, request.auth.sub);
  }

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

  @Get('subscription-plans')
  subscriptionPlans() { return this.platform.subscriptionPlans(); }

  @Post('website-plans')
  @PlatformRoles('super_admin','billing_admin')
  createWebsitePlan(@Body() body: WebsitePlanDto, @Req() request: AuthenticatedRequest) {
    return this.platform.createWebsitePlan(body, request.auth.sub);
  }

  @Patch('website-plans/:code')
  @PlatformRoles('super_admin','billing_admin')
  updateWebsitePlan(@Param('code') code: string,
    @Body() body: WebsitePlanDto, @Req() request: AuthenticatedRequest) {
    return this.platform.updateWebsitePlan(code, body, request.auth.sub);
  }

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
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
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
  errors(@Query('view') view?: string) {
    if(view && view!=='active' && view!=='archived') throw new BadRequestException('Invalid diagnostics view');
    return this.platform.recentErrors(view==='archived'?'archived':'active');
  }

  @Patch('diagnostics/:resource/:id/archive')
  @PlatformRoles('super_admin','support_admin')
  archiveDiagnostic(@Param('resource') resource:string,@Param('id',ParseUUIDPipe) id:string,
    @Body() body:ArchiveDiagnosticDto,@Req() request:AuthenticatedRequest) {
    if (!['session','message','webhook'].includes(resource)) {
      throw new BadRequestException('Invalid diagnostic resource type');
    }
    return this.platform.archiveDiagnostic(resource as 'session'|'message'|'webhook',id,body.reason,request.auth.sub);
  }

  @Post('support/ask')
  supportAsk(@Body() body: PlatformSupportQuestionDto) {
    return this.platform.supportAnswer(body.message);
  }
}
