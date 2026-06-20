import { forwardRef, Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthTokenFactory } from './auth-token.factory';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AdminGuard } from './admin.guard';
import { MailModule } from '../../platform/mail/mail.module';
import { InviteModule } from '../../billing/invite/invite.module';

const jwtAccessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ?? '1d') as JwtSignOptions['expiresIn'];

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: jwtAccessExpiresIn },
    }),
    MailModule,
    forwardRef(() => InviteModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionRepository,
    AuthTokenFactory,
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
