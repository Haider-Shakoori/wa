import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SendMediaMessageDto, SendTextMessageDto } from './messages.dto';
import { MessagesService } from './messages.service';

@Controller('v1/sessions/:sessionId/messages')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('text')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendText(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendTextMessageDto,
  ) {
    return this.messages.queueText(request.auth.org, request.auth.sub, sessionId, body);
  }

  @Post('image')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendImage(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.queueMedia(request.auth.org, request.auth.sub, sessionId, 'image', body);
  }

  @Post('video')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendVideo(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.queueMedia(request.auth.org, request.auth.sub, sessionId, 'video', body);
  }

  @Post('audio')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendAudio(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.queueMedia(request.auth.org, request.auth.sub, sessionId, 'audio', body);
  }

  @Post('document')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendDocument(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.queueMedia(request.auth.org, request.auth.sub, sessionId, 'document', body);
  }

  @Get(':messageId')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  get(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messages.get(request.auth.org, sessionId, messageId);
  }
}
