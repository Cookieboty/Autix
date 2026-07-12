import { forwardRef, Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthIdentityRepository } from './auth-identity.repository';
import { AuthService } from './auth.service';
import { EmailChangeService } from './email-change.service';
import { AccountDeletionService } from './account-deletion.service';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthTokenFactory } from './auth-token.factory';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MembershipGuard } from './membership.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AdminGuard } from './admin.guard';
import { MailModule } from '../../platform/mail/mail.module';
import { CommonModule } from '../../platform/common/common.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { InviteModule } from '../../billing/invite/invite.module';
import { CampaignModule } from '../../billing/campaign/campaign.module';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { OAuthProviderRegistry } from './oauth/oauth-provider.registry';
import { GoogleProvider } from './oauth/providers/google.provider';
import { AppleProvider } from './oauth/providers/apple.provider';
import { GitHubProvider } from './oauth/providers/github.provider';
import { AccountResolutionService } from './oauth/account-resolution.service';
import { SocialLoginRepository } from './oauth/social-login.repository';
import { TokenCipher } from './oauth/token-cipher';
import { OAuthConfigService } from './oauth/oauth-config.service';
import { StepUpService } from './step-up/step-up.service';
import { StepUpRepository } from './step-up/step-up.repository';
import { StepUpCleanupCron } from './step-up/step-up-cleanup.cron';
import { EmailHashService } from './step-up/email-hash.service';

const jwtAccessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ?? '1d') as JwtSignOptions['expiresIn'];

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: jwtAccessExpiresIn },
    }),
    MailModule,
    CommonModule,
    StorageModule,
    CampaignModule,
    forwardRef(() => InviteModule),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    EmailChangeService,
    AccountDeletionService,
    AuthIdentityRepository,
    AuthSessionRepository,
    AuthTokenFactory,
    StepUpService,
    StepUpRepository,
    StepUpCleanupCron,
    EmailHashService,
    JwtStrategy,
    AdminGuard,
    MembershipGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    OAuthService,
    OAuthConfigService,
    { provide: GoogleProvider, useFactory: (c: OAuthConfigService) => new GoogleProvider(c), inject: [OAuthConfigService] },
    { provide: AppleProvider, useFactory: (c: OAuthConfigService) => new AppleProvider(c), inject: [OAuthConfigService] },
    { provide: GitHubProvider, useFactory: (c: OAuthConfigService) => new GitHubProvider(c), inject: [OAuthConfigService] },
    {
      provide: OAuthProviderRegistry,
      useFactory: (g: GoogleProvider, a: AppleProvider, h: GitHubProvider, c: OAuthConfigService) =>
        new OAuthProviderRegistry(g, a, h, c),
      inject: [GoogleProvider, AppleProvider, GitHubProvider, OAuthConfigService],
    },
    AccountResolutionService,
    SocialLoginRepository,
    {
      provide: TokenCipher,
      // Guard against missing/invalid key at module bootstrap (test & typecheck envs).
      // Construction is deferred: the factory returns a Proxy that constructs the real
      // TokenCipher on first method call, so the module can be loaded without the key.
      // In production the key is present and the real instance is constructed on first use,
      // which is the first call to encrypt/decrypt inside AccountResolutionService.
      useFactory: () => {
        const hexKey = process.env.OAUTH_TOKEN_ENC_KEY ?? '';
        if (hexKey.length === 64) {
          return new TokenCipher(hexKey);
        }
        // Key absent (dev/test env): return a lazy proxy that throws only when used.
        const lazyThrow = () => { throw new Error('OAUTH_TOKEN_ENC_KEY must be 32-byte hex'); };
        return new Proxy({} as TokenCipher, {
          get(_target, prop) {
            if (prop === 'encrypt' || prop === 'decrypt') return lazyThrow;
            return undefined;
          },
        });
      },
    },
  ],
  exports: [JwtModule, AuthService, AdminGuard, MembershipGuard, AuthIdentityRepository, StepUpService, EmailHashService],
})
export class AuthModule { }
