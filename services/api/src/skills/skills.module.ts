import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { SkillsService } from './skills.service';
import { SkillsController, SkillsAdminController } from './skills.controller';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [SkillsController, SkillsAdminController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
