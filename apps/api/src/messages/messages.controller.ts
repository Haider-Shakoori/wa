import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
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

  @Post('reply')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendReply(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendReplyDto,
  ) {
    return this.messages.queueAction(request.auth.org, request.auth.sub, sessionId, 'reply', body);
  }

  @Post('reaction')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendReaction(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendReactionDto,
  ) {
    return this.messages.queueAction(request.auth.org, request.auth.sub, sessionId, 'reaction', body);
  }

  @Post('location')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendLocation(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendLocationDto,
  ) {
    return this.messages.queueAction(request.auth.org, request.auth.sub, sessionId, 'location', body);
  }

  @Post('contact')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendContact(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendContactDto,
  ) {
    return this.messages.queueAction(request.auth.org, request.auth.sub, sessionId, 'contact', body);
  }

  @Post('poll')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  sendPoll(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: SendPollDto,
  ) {
    return this.messages.queueAction(request.auth.org, request.auth.sub, sessionId, 'poll', body);
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
