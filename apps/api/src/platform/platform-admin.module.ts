import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';

@Module({
  controllers: [PlatformAdminController],
})
export class PlatformAdminModule {}
