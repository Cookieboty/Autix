import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { RegistrationModule } from '../../identity/registration/registration.module';
import { SseModule } from '../../platform/sse/sse.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { PointsModule } from '../../billing/points/points.module';
import { OrderModule } from '../../billing/order/order.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { AdminService } from './admin.service';
import { BatchJobService } from './batch-job.service';
import { ResourceMigrationService } from './resource-migration.service';
import { AdminAuditStore } from './admin-audit.store';
import { AdminRepository } from './admin.repository';
import { BatchJobRepository } from './batch-job.repository';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RegistrationModule,
    SseModule,
    StorageModule,
    PointsModule,
    OrderModule,
    MembershipModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminRepository,
    BatchJobRepository,
    BatchJobService,
    ResourceMigrationService,
    AdminAuditStore,
  ],
  exports: [AdminService, BatchJobService, ResourceMigrationService, AdminAuditStore],
})
export class AdminModule {}
