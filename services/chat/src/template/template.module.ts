import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { TemplateService } from './template.service';
import {
  TemplateController,
  GenerationController,
  TemplateAdminController,
} from './template.controller';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule],
  controllers: [TemplateController, GenerationController, TemplateAdminController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
