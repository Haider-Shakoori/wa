import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PlatformRoles } from '../auth/platform-roles.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateCheckoutDto, CreateManualPaymentDto, UpdateProviderDto } from './payments.dto';
import { PaymentsService } from './payments.service';
import { StripeProvider } from './stripe.provider';

@Controller(['billing', 'v1/billing'])
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeProvider,
  ) {}

  @Get('providers')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  providers() {
    return this.payments.providers();
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  history(@Req() request: AuthenticatedRequest) {
    return this.payments.history(request.auth.org);
  }

  @Get('payments/:paymentId/invoice')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  invoice(@Req() request: AuthenticatedRequest,@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.payments.invoice(request.auth.org,paymentId);
  }

  @Post('checkout/stripe')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  checkout(@Req() request: AuthenticatedRequest, @Body() body: CreateCheckoutDto) {
    return this.payments.createStripeCheckout(request.auth.org, body);
  }

  @Post('stripe/billing-portal')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  billingPortal(@Req() request: AuthenticatedRequest) {
    return this.payments.createStripeBillingPortal(request.auth.org);
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  manual(@Req() request: AuthenticatedRequest, @Body() body: CreateManualPaymentDto) {
    return this.payments.createManual(request.auth.org, body);
  }

  @Post('checkout/demo')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  demo(@Req() request: AuthenticatedRequest, @Body() body: CreateCheckoutDto) {
    return this.payments.createDemo(request.auth.org, body);
  }

  // Cloudflare verifies the original Stripe signature before forwarding. This
  // separate signed transport does not expose the Stripe webhook secret to VPS.
  // Synchronize Cloudflare's pending checkout before Stripe completion arrives.
  // The same signed transport is used, but checkout data is never treated as proof of payment.
  @Post('stripe/pending-checkout')
  async pendingStripeCheckout(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-relaywa-timestamp') timestamp?: string,
    @Headers('x-relaywa-signature') signature?: string,
  ) {
    const payload = this.verifyBillingTransport(request, timestamp, signature);
    return this.payments.syncPendingStripeCheckout(payload);
  }

  private verifyBillingTransport(request: RawBodyRequest<Request>, timestamp?: string, signature?: string) {
    const secret = process.env.RELAYWA_BILLING_FORWARD_SECRET;
    if (!secret || secret.length < 32 || !request.rawBody || !timestamp || !signature) {
      throw new BadRequestException('Invalid billing event transport');
    }
    if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      throw new BadRequestException('Expired billing event');
    }
    if (!/^sha256=[a-f0-9]{64}$/.test(signature)) throw new BadRequestException('Invalid billing event signature');
    const expected = createHmac('sha256', secret).update(timestamp).update('.').update(request.rawBody).digest();
    const supplied = Buffer.from(signature.slice(7), 'hex');
    if (!timingSafeEqual(expected, supplied)) {
      throw new BadRequestException('Invalid billing event signature');
    }
    try { return JSON.parse(request.rawBody.toString('utf8')); }
    catch { throw new BadRequestException('Invalid billing event JSON'); }
  }

  @Post('stripe/verified-event')
  async verifiedStripeEvent(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-relaywa-timestamp') timestamp?: string,
    @Headers('x-relaywa-signature') signature?: string,
  ) {
    const event: any = this.verifyBillingTransport(request, timestamp, signature);
    if (!event || typeof event.id !== 'string' || !/^evt_[A-Za-z0-9]+$/.test(event.id)
      || typeof event.type !== 'string' || !event.data?.object) {
      throw new BadRequestException('Invalid Stripe event envelope');
    }
    return this.payments.handleForwardedStripeEvent(event);
  }

  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature || !request.rawBody) throw new BadRequestException('Missing Stripe webhook signature or body');
    const event = this.stripe.constructEvent(request.rawBody, signature);
    return this.payments.handleStripeEvent(event);
  }

  @Post('admin/manual/:paymentId/approve')
  @PlatformRoles('super_admin','billing_admin')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  approveManual(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.payments.approveManual(paymentId);
  }

  @Post('admin/providers')
  @PlatformRoles('super_admin','billing_admin')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  updateProvider(@Body() body: UpdateProviderDto) {
    return this.payments.updateProvider(body);
  }
}

[executed on device: businessos-dev-vps (9b1cdbf1-1a02-4fe8-9e81-8871c3eca22c)]