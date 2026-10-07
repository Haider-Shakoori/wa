import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { SendMessageController } from './send-message.controller';
import { SessionKeyGuard } from './session-key.guard';

@Module({
  controllers: [MessagesController, SendMessageController],
  providers: [MessagesService, SessionKeyGuard],
})
export class MessagesModule {}
