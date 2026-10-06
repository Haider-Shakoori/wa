import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'development-only-change-me',
      signOptions: { expiresIn: Number(process.env.JWT_EXPIRES_SECONDS ?? 3600) },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionGuard, PlatformAdminGuard],
  exports: [JwtAuthGuard, PermissionGuard, PlatformAdminGuard],
})
export class AuthModule {}
