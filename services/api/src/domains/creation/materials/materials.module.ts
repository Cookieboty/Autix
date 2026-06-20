import { Module } from '@nestjs/common';
import { MembershipModule } from '../../billing/membership/membership.module';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { MaterialsController } from './materials.controller';
import { MaterialsRepository } from './materials.repository';
import { MaterialsService } from './materials.service';

@Module({
  imports: [MembershipModule, PrismaModule, StorageModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialsRepository],
  exports: [MaterialsService],
})
export class MaterialsModule {}
