import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Redirect, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdaptiveLoginProtectionService } from './adaptive-login-protection.service';
import type { Request } from 'express';
import { GithubExchangeDto, GoogleAuthDto, LoginDto, RegisterDto, MfaVerifyDto, MfaCodeDto } from './auth.dto';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

@Controller(['auth', 'v1/auth'])
export class AuthController {
  constructor(private readonly auth: AuthService,
    private readonly loginProtection:AdaptiveLoginProtectionService) {}

  @Get('providers')
  providers() {
    return this.auth.providers();
  }

  @Post('register')
  register(@Body() body: RegisterDto,@Req() request: Request) {
    return this.auth.register(body,{
      ip:request.ip,userAgent:request.headers['user-agent']??undefined,
    });
  }

  @Get('login-protection')
  loginProtectionStatus(@Query('email') email:string|undefined,@Req() request:Request) {
    return this.loginProtection.status(String(email??'').slice(0,254),{
      ip:request.ip,
      userAgent:request.headers['user-agent']??undefined,
    });
  }

  @Post('login')
  login(@Body() body: LoginDto, @Req() request: Request) {
    return this.auth.login(body, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? undefined,
    });
  }

  @Post('google')
  google(@Body() body: GoogleAuthDto,@Req() request: Request) {
    return this.auth.google(body,{
      ip:request.ip,userAgent:request.headers['user-agent']??undefined,
    });
  }

  @Get('github/start')
  @Redirect(undefined, 302)
  async githubStart(@Query('returnTo') returnTo?: string) {
    return { url: await this.auth.githubAuthorizeUrl(returnTo) };
  }

  @Get('github/callback')
  @Redirect(undefined, 302)
  async githubCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    return { url: await this.auth.githubCallback(code, state, error) };
  }

  @Post('github/exchange')
  githubExchange(@Body() body: GithubExchangeDto,@Req() request: Request) {
    return this.auth.githubExchange(body.code,{
      ip:request.ip,userAgent:request.headers['user-agent']??undefined,
    });
  }

  @Post('mfa/verify')
  verifyMfa(@Body() body: MfaVerifyDto) {
    return this.auth.verifyMfaChallenge(body.ticket, body.code);
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  mfaStatus(@Req() request: AuthenticatedRequest) {
    return this.auth.mfaStatus(request.auth.sub);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  mfaSetup(@Req() request: AuthenticatedRequest) {
    return this.auth.beginMfaSetup(request.auth.sub);
  }

  @Post('mfa/confirm')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  mfaConfirm(@Req() request: AuthenticatedRequest, @Body() body: MfaCodeDto) {
    return this.auth.confirmMfaSetup(request.auth.sub, body.code);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  sessions(@Req() request: AuthenticatedRequest) {
    return this.auth.userSessions(request.auth.sub);
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  revokeAll(@Req() request: AuthenticatedRequest) {
    return this.auth.revokeAllSessions(request.auth.sub);
  }

  @Post('sessions/:sessionId/revoke')
  @UseGuards(JwtAuthGuard)
  revokeOne(@Req() request: AuthenticatedRequest, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.auth.revokeSession(request.auth.sub, sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    return { auth: request.auth, user: await this.auth.profile(request.auth.sub) };
  }
}
