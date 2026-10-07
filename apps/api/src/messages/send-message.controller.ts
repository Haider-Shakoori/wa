import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiAccessGuard, type ApiAuthenticatedRequest } from '../auth/api-access.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { PERMISSIONS } from '../auth/permissions';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SendMediaMessageDto, SendTextMessageDto } from './messages.dto';
import { SendContactDto, SendLocationDto, SendPollDto, SendReactionDto, SendReplyDto } from './action.dto';
import { MessagesService } from './messages.service';
import { SessionKeyGuard } from './session-key.guard';

@Controller()
@UseGuards(ApiAccessGuard, SessionKeyGuard, PermissionGuard)
@RequirePermissions(PERMISSIONS.MESSAGES_SEND)
export class SendMessageController {
  constructor(private readonly messages: MessagesService) {}

  @Post('send-message')
  async text(@Req() request: ApiAuthenticatedRequest, @Body() body: SendTextMessageDto) {
    return { success: true, data: await this.messages.sendText(request.auth.org, request.auth.sub, String(request.params.sessionId), body) };
  }

  @Post('send-image')
  async image(@Req() request: ApiAuthenticatedRequest, @Body() body: SendMediaMessageDto) {
    return { success: true, data: await this.messages.sendMedia(request.auth.org, request.auth.sub, String(request.params.sessionId), 'image', body) };
  }
  @Post('send-video')
  async video(@Req() request: ApiAuthenticatedRequest, @Body() body: SendMediaMessageDto) {
    return { success: true, data: await this.messages.sendMedia(request.auth.org, request.auth.sub, String(request.params.sessionId), 'video', body) };
  }
  @Post('send-audio')
  async audio(@Req() request: ApiAuthenticatedRequest, @Body() body: SendMediaMessageDto) {
    return { success: true, data: await this.messages.sendMedia(request.auth.org, request.auth.sub, String(request.params.sessionId), 'audio', body) };
  }
  @Post('send-document')
  async document(@Req() request: ApiAuthenticatedRequest, @Body() body: SendMediaMessageDto) {
    return { success: true, data: await this.messages.sendMedia(request.auth.org, request.auth.sub, String(request.params.sessionId), 'document', body) };
  }
  @Post('send-location')
  async location(@Req() request: ApiAuthenticatedRequest, @Body() body: SendLocationDto) {
    return { success: true, data: await this.messages.sendAction(request.auth.org, request.auth.sub, String(request.params.sessionId), 'location', body) };
  }
  @Post('send-contact')
  async contact(@Req() request: ApiAuthenticatedRequest, @Body() body: SendContactDto) {
    return { success: true, data: await this.messages.sendAction(request.auth.org, request.auth.sub, String(request.params.sessionId), 'contact', body) };
  }
  @Post('send-poll')
  async poll(@Req() request: ApiAuthenticatedRequest, @Body() body: SendPollDto) {
    return { success: true, data: await this.messages.sendAction(request.auth.org, request.auth.sub, String(request.params.sessionId), 'poll', body) };
  }
  @Post('send-reply')
  async reply(@Req() request: ApiAuthenticatedRequest, @Body() body: SendReplyDto) {
    return { success: true, data: await this.messages.sendAction(request.auth.org, request.auth.sub, String(request.params.sessionId), 'reply', body) };
  }
  @Post('send-reaction')
  async reaction(@Req() request: ApiAuthenticatedRequest, @Body() body: SendReactionDto) {
    return { success: true, data: await this.messages.sendAction(request.auth.org, request.auth.sub, String(request.params.sessionId), 'reaction', body) };
  }
}
