import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { I18nModule } from './i18n/i18n.module';
import { MailModule } from './mail/mail.module';
import { OperationsModule } from './operations/operations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResourceMetricsModule } from './resource-metrics/resource-metrics.module';
import { SseModule } from './sse/sse.module';
import { StorageModule } from './storage/storage.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';

@Module({
  imports: [
    I18nModule,
    PrismaModule,
    CommonModule,
    MailModule,
    OperationsModule,
    ResourceMetricsModule,
    SseModule,
    StorageModule,
    SystemSettingsModule,
  ],
  exports: [
    I18nModule,
    PrismaModule,
    CommonModule,
    MailModule,
    OperationsModule,
    ResourceMetricsModule,
    SseModule,
    StorageModule,
    SystemSettingsModule,
  ],
})
export class PlatformDomainModule {}
