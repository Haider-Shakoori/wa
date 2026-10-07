import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiAccessGuard, type ApiAuthenticatedRequest } from '../auth/api-access.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SendMediaMessageDto, SendTextMessageDto } from './messages.dto';
import {
  SendContactDto,
  SendLocationDto,
  SendPollDto,
  SendReactionDto,
  SendReplyDto,
} from './action.dto';
import { MessagesService } from './messages.service';

@Controller(['whatsapp-sessions/:sessionId/messages', 'v1/sessions/:sessionId/messages'])
@UseGuards(ApiAccessGuard, PermissionGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MESSAGES_READ)
  list(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.messages.list(request.auth.org, sessionId);
  }

  @Post('text')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendText(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendTextMessageDto,
  ) {
    return this.messages.sendText(request.auth.org, request.auth.sub, sessionId, body);
  }

  @Post('image')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendImage(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.sendMedia(request.auth.org, request.auth.sub, sessionId, 'image', body);
  }

  @Post('video')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendVideo(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.sendMedia(request.auth.org, request.auth.sub, sessionId, 'video', body);
  }

  @Post('audio')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendAudio(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.sendMedia(request.auth.org, request.auth.sub, sessionId, 'audio', body);
  }

  @Post('document')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendDocument(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendMediaMessageDto,
  ) {
    return this.messages.sendMedia(request.auth.org, request.auth.sub, sessionId, 'document', body);
  }

  @Post('reply')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendReply(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendReplyDto,
  ) {
    return this.messages.sendAction(request.auth.org, request.auth.sub, sessionId, 'reply', body);
  }

  @Post('reaction')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendReaction(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendReactionDto,
  ) {
    return this.messages.sendAction(request.auth.org, request.auth.sub, sessionId, 'reaction', body);
  }

  @Post('location')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendLocation(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendLocationDto,
  ) {
    return this.messages.sendAction(request.auth.org, request.auth.sub, sessionId, 'location', body);
  }

  @Post('contact')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendContact(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendContactDto,
  ) {
    return this.messages.sendAction(request.auth.org, request.auth.sub, sessionId, 'contact', body);
  }

  @Post('poll')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendPoll(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendPollDto,
  ) {
    return this.messages.sendAction(request.auth.org, request.auth.sub, sessionId, 'poll', body);
  }

  @Get(':messageId')
  @RequirePermissions(PERMISSIONS.MESSAGES_READ)
  get(
    @Req() request: ApiAuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messages.get(request.auth.org, sessionId, messageId);
  }
}
