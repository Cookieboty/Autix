import { Module } from '@nestjs/common';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [CloudflareR2Service],
  exports: [CloudflareR2Service],
})
export class StorageModule {}
