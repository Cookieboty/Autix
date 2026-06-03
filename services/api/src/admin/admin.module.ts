import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RegistrationModule } from '../registration/registration.module';
import { SseModule } from '../sse/sse.module';
import { StorageModule } from '../storage/storage.module';
import { BatchJobService } from './batch-job.service';
import { ResourceMigrationService } from './resource-migration.service';

@Module({
  imports: [PrismaModule, AuthModule, RegistrationModule, SseModule, StorageModule],
  controllers: [AdminController],
  providers: [BatchJobService, ResourceMigrationService],
  exports: [BatchJobService, ResourceMigrationService],
})
export class AdminModule {}
