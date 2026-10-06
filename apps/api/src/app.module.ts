import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PlatformAdminModule } from './platform/platform-admin.module';

@Module({
  imports: [DatabaseModule, AuthModule, OrganizationsModule, PlatformAdminModule],
  controllers: [AppController],
})
export class AppModule {}
