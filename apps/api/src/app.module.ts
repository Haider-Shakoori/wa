import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PlatformAdminModule } from './platform/platform-admin.module';
import { MessageHistoryModule } from './message-history/message-history.module';
import { SessionsModule } from './sessions/sessions.module';
import { MessagesModule } from './messages/messages.module';
import { DirectoryModule } from './directory/directory.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    MessageHistoryModule,
    PlatformAdminModule,
    SessionsModule,
    MessagesModule,
    DirectoryModule,
    WebhooksModule,
    ApiKeysModule,
    SubscriptionsModule,
    PaymentsModule,
    OnboardingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
