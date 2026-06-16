import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [SystemSettingsModule],
  controllers: [StorageController],
  providers: [CloudflareR2Service],
  exports: [CloudflareR2Service],
})
export class StorageModule {}
