import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { StorageCleanupService } from './storage-cleanup.service';
import { StorageCleanupCron } from './storage-cleanup.cron';
import { StorageController } from './storage.controller';
import { ProfileMediaPresignService } from './profile-media-presign.service';
import { AvatarImageProcessor } from './avatar-image-processor.service';

@Module({
  imports: [SystemSettingsModule, PrismaModule],
  controllers: [StorageController],
  providers: [CloudflareR2Service, StorageCleanupService, StorageCleanupCron, ProfileMediaPresignService, AvatarImageProcessor],
  exports: [CloudflareR2Service, StorageCleanupService, ProfileMediaPresignService, AvatarImageProcessor],
})
export class StorageModule { }
