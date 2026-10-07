import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ContinueOnboardingDto, SelectPlanDto, UpdateWorkspaceDto } from './onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller(['onboarding', 'v1/onboarding'])
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('state')
  state(@Req() request: AuthenticatedRequest) {
    return this.onboarding.state(request.auth.org);
  }

  @Post('plan')
  selectPlan(@Req() request: AuthenticatedRequest, @Body() body: SelectPlanDto) {
    return this.onboarding.selectPlan(request.auth.org, body);
  }

  @Patch('workspace')
  updateWorkspace(@Req() request: AuthenticatedRequest, @Body() body: UpdateWorkspaceDto) {
    return this.onboarding.updateWorkspace(request.auth.org, body);
  }

  @Post('continue')
  continue(@Req() request: AuthenticatedRequest, @Body() body: ContinueOnboardingDto) {
    return this.onboarding.continue(request.auth.org, body);
  }
}
