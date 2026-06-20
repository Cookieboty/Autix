import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { I18nModule } from './i18n/i18n.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { SseModule } from './sse/sse.module';
import { StorageModule } from './storage/storage.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { AmuxProxyModule } from './amux-proxy/amux-proxy.module';

@Module({
  imports: [
    I18nModule,
    PrismaModule,
    CommonModule,
    MailModule,
    SseModule,
    StorageModule,
    SystemSettingsModule,
    AmuxProxyModule,
  ],
  exports: [
    I18nModule,
    PrismaModule,
    CommonModule,
    MailModule,
    SseModule,
    StorageModule,
    SystemSettingsModule,
    AmuxProxyModule,
  ],
})
export class PlatformDomainModule {}
