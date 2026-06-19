import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { I18nMiddleware } from './i18n/i18n.middleware';
import { AdminDomainModule } from './domains/admin/admin-domain.module';
import { BillingDomainModule } from './domains/billing/billing-domain.module';
import { CreationDomainModule } from './domains/creation/creation-domain.module';
import { IdentityDomainModule } from './domains/identity/identity-domain.module';
import { MarketplaceDomainModule } from './domains/marketplace/marketplace-domain.module';
import { PlatformDomainModule } from './domains/platform/platform-domain.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PlatformDomainModule,
    IdentityDomainModule,
    BillingDomainModule,
    CreationDomainModule,
    MarketplaceDomainModule,
    AdminDomainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nMiddleware).forRoutes('*');
  }
}
