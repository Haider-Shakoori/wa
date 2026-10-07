import { Body, Controller, Delete, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateApiKeyDto } from './api-keys.dto';
import { ApiKeysService } from './api-keys.service';

@Controller(['api-keys', 'v1/api-keys'])
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.keys.list(request.auth.org);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateApiKeyDto) {
    return this.keys.create(request.auth.org, request.auth.sub, body);
  }

  @Get(':keyId/token')
  @Header('Cache-Control', 'no-store')
  reveal(@Req() request: AuthenticatedRequest, @Param('keyId') keyId: string) {
    return this.keys.reveal(request.auth.org, keyId);
  }

  @Delete(':keyId')
  revoke(@Req() request: AuthenticatedRequest, @Param('keyId') keyId: string) {
    return this.keys.revoke(request.auth.org, keyId);
  }
}
