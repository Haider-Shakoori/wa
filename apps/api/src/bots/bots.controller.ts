import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { BotsService } from './bots.service';
import { CreateBotDto, CreateFaqDto } from './bots.dto';

@Controller('bots')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BotsController {
  constructor(private readonly bots: BotsService) {}
  @Get()
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  list(@Req() req: AuthenticatedRequest) { return this.bots.list(req.auth.org); }
  @Post()
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBotDto) {
    return this.bots.create(req.auth.org,req.auth.sub,dto);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  get(@Req() req: AuthenticatedRequest, @Param('id') id:string) {
    return this.bots.get(req.auth.org,id);
  }
  @Get(':id/faqs')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  faqs(@Req() req: AuthenticatedRequest,@Param('id') id:string) {
    return this.bots.faqs(req.auth.org,id);
  }
  @Post(':id/faqs')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  addFaq(@Req() req: AuthenticatedRequest,@Param('id') id:string,@Body() dto:CreateFaqDto) {
    return this.bots.addFaq(req.auth.org,id,dto);
  }
  @Delete(':id/faqs/:faqId')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  removeFaq(@Req() req: AuthenticatedRequest,@Param('id') id:string,@Param('faqId') faqId:string) {
    return this.bots.removeFaq(req.auth.org,id,faqId);
  }
}
