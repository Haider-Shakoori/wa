import { Body, Controller, Get, Param, Post, Req, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
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
import { FileInterceptor } from '@nestjs/platform-express';
import { validateMediaInput, type MediaType } from './media-policy';
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

  @Post('file')
  @RequirePermissions(PERMISSIONS.MESSAGES_SEND)
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:100*1024*1024,files:1,fields:3}}))
  async sendFile(@Req() request: ApiAuthenticatedRequest,@Param('sessionId') sessionId:string,
    @UploadedFile() file:{buffer:Buffer;size:number;mimetype:string;originalname:string},
    @Body() body:{to:string;type:MediaType;caption?:string}) {
    try {
    if(!file||!['image','video','audio','document'].includes(body.type)||typeof body.to!=='string')throw new BadRequestException('Choose a file, type and recipient');
    if(body.caption!==undefined&&(typeof body.caption!=='string'||body.caption.length>4096))throw new BadRequestException('Caption must be at most 4096 characters');
    validateMediaInput(body.type,'https://upload.relaywa.invalid/file',file.mimetype,file.size);
    return await this.messages.sendMedia(request.auth.org,request.auth.sub,sessionId,body.type,
      {to:body.to,url:'https://upload.relaywa.invalid/file',mimeType:file.mimetype,mediaSizeBytes:file.size,fileName:file.originalname.slice(0,255),caption:body.caption},file.buffer);
    } finally { file?.buffer.fill(0); }
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
