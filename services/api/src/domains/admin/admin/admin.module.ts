import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { RegistrationModule } from '../../identity/registration/registration.module';
import { SseModule } from '../../platform/sse/sse.module';
import { PointsModule } from '../../billing/points/points.module';
import { OrderModule } from '../../billing/order/order.module';
import { MembershipModule } from '../../billing/membership/membership.module';
import { AdminService } from './admin.service';
import { BatchJobService } from './batch-job.service';
import { AdminAuditStore } from './admin-audit.store';
import { AdminRepository } from './admin.repository';
import { BatchJobRepository } from './batch-job.repository';
import { PricingConfigAdminModule } from './pricing-config/pricing-config-admin.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RegistrationModule,
    SseModule,
    PointsModule,
    OrderModule,
    MembershipModule,
    PricingConfigAdminModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminRepository,
    BatchJobRepository,
    BatchJobService,
    AdminAuditStore,
  ],
  exports: [AdminService, BatchJobService, AdminAuditStore],
})
export class AdminModule {}
