import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { I18nMiddleware } from './domains/platform/i18n/i18n.middleware';
import { TraceContextMiddleware } from './domains/platform/common/trace-context.middleware';
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
    // 全局限流基线（内存存储，单实例生效；多副本部署需接 Redis storage）。
    // 基线放宽以免影响 SSE/轮询等正常流量；auth/oauth 端点用 @Throttle 覆盖为严格限制。
    // THROTTLE_LIMIT=0 或未配置时回退到 1000/分钟。
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.THROTTLE_TTL) || 60_000,
        limit: Number(process.env.THROTTLE_LIMIT) || 1000,
      },
    ]),
    PlatformDomainModule,
    IdentityDomainModule,
    BillingDomainModule,
    CreationDomainModule,
    MarketplaceDomainModule,
    AdminDomainModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局启用限流守卫，使各 controller 上的 @Throttle 装饰器真正生效。
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 顺序敏感：TraceContext 必须在最前，才能让后续 middleware / interceptor /
    // filter / 所有 service 的 AppLogger 都能通过 AsyncLocalStorage 拿到同一
    // 个 traceId。
    consumer.apply(TraceContextMiddleware, I18nMiddleware).forRoutes('*');
  }
}
