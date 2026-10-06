import { Module } from '@nestjs/common';
import { QrService } from './qr.service';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, QrService],
})
export class SessionsModule {}
