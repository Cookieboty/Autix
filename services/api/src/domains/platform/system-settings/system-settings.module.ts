import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemPromptController } from './system-prompt.controller';
import { SystemPromptService } from './system-prompt.service';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SystemSettingsController, SystemPromptController],
  providers: [SystemSettingsService, SystemPromptService],
  exports: [SystemSettingsService, SystemPromptService],
})
export class SystemSettingsModule {}
