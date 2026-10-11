import {
  Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Query, Req,
  ServiceUnavailableException, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { ApiAccessGuard, type ApiAuthenticatedRequest } from '../auth/api-access.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { StartPhoneVerificationDto } from './phone-verification.dto';
import { PhoneVerificationService } from './phone-verification.service';

@Controller('v1/verifications/whatsapp')
@UseGuards(ApiAccessGuard, PermissionGuard)
export class PhoneVerificationController {
  constructor(private readonly verification: PhoneVerificationService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.VERIFICATIONS_MANAGE)
  start(@Req() request: ApiAuthenticatedRequest, @Body() body: StartPhoneVerificationDto) {
    return this.verification.start(request.auth.org, body.phone);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VERIFICATIONS_READ)
  status(@Req() request: ApiAuthenticatedRequest, @Param('id') id: string) {
    return this.verification.status(request.auth.org, id);
  }

  @Post(':id/consume')
  @RequirePermissions(PERMISSIONS.VERIFICATIONS_MANAGE)
  consume(@Req() request: ApiAuthenticatedRequest, @Param('id') id: string) {
    return this.verification.consume(request.auth.org, id);
  }
}

@Controller('v1/verifications/whatsapp/meta')
export class MetaPhoneVerificationWebhookController {
  constructor(private readonly verification: PhoneVerificationService) {}

  @Get('webhook')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ) {
    const secret = process.env.RELAYWA_VERIFY_META_WEBHOOK_TOKEN;
    if (!secret || secret.length < 16) throw new ServiceUnavailableException('Meta webhook token not configured');
    if (mode !== 'subscribe' || !safeEqual(token, secret) || !challenge) {
      throw new UnauthorizedException('Invalid Meta webhook validation');
    }
    return challenge;
  }

  @Post('webhook')
  @HttpCode(200)
  async incoming(
    @Req() request: Request & {rawBody?: Buffer},
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    const secret = process.env.RELAYWA_VERIFY_META_APP_SECRET;
    if (!secret || secret.length < 16) throw new ServiceUnavailableException('Meta App Secret not configured');
    const expected = request.rawBody && `sha256=${createHmac('sha256', secret).update(request.rawBody).digest('hex')}`;
    if (!expected || !safeEqual(signature, expected)) {
      throw new UnauthorizedException('Invalid Meta webhook signature');
    }
    await this.verification.receiveSignedWebhook(request.body);
    return { received: true };
  }
}

function safeEqual(left: string | undefined, right: string) {
  if (!left) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
