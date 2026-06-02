import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AdminGuard } from './admin.guard';
import { MailModule } from '../mail/mail.module';
import { InviteModule } from '../invite/invite.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN as any) ?? '1d' },
    }),
    MailModule,
    forwardRef(() => InviteModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AdminGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [JwtModule, AuthService, AdminGuard],
})
export class AuthModule {}
