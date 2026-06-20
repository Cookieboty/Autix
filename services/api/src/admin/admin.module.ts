import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RegistrationModule } from '../registration/registration.module';
import { SseModule } from '../sse/sse.module';
import { StorageModule } from '../storage/storage.module';
import { PointsModule } from '../points/points.module';
import { OrderModule } from '../order/order.module';
import { AdminService } from './admin.service';
import { BatchJobService } from './batch-job.service';
import { ResourceMigrationService } from './resource-migration.service';
import { AdminAuditStore } from './admin-audit.store';

@Module({
  imports: [PrismaModule, AuthModule, RegistrationModule, SseModule, StorageModule, PointsModule, OrderModule],
  controllers: [AdminController],
  providers: [AdminService, BatchJobService, ResourceMigrationService, AdminAuditStore],
  exports: [AdminService, BatchJobService, ResourceMigrationService, AdminAuditStore],
})
export class AdminModule {}
