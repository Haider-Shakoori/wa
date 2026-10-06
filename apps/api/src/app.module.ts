import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PlatformAdminModule } from './platform/platform-admin.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    PlatformAdminModule,
    SessionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
