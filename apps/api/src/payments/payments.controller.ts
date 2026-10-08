import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
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

  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature || !request.rawBody) throw new Error('Missing Stripe webhook signature/body');
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
