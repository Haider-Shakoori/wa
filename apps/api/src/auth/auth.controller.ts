import { Body, Controller, Get, Post, Query, Redirect, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GithubExchangeDto, GoogleAuthDto, LoginDto, RegisterDto } from './auth.dto';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard';

@Controller(['auth', 'v1/auth'])
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('providers')
  providers() {
    return this.auth.providers();
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post('google')
  google(@Body() body: GoogleAuthDto) {
    return this.auth.google(body);
  }

  @Get('github/start')
  @Redirect(undefined, 302)
  githubStart(@Query('returnTo') returnTo?: string) {
    return { url: this.auth.githubAuthorizeUrl(returnTo) };
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
  githubExchange(@Body() body: GithubExchangeDto) {
    return this.auth.githubExchange(body.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    return { auth: request.auth, user: await this.auth.profile(request.auth.sub) };
  }
}
