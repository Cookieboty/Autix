import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { CommonModule } from '../../platform/common/common.module';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { SkillsService } from './skills.service';
import { SkillsController, SkillsAdminController } from './skills.controller';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [SkillsController, SkillsAdminController],
  providers: [SkillsService, MarketplaceResourceCrudRepository],
  exports: [SkillsService],
})
export class SkillsModule {}
