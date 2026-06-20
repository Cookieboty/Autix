import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemPromptController } from './system-prompt.controller';
import { SystemPromptRepository } from './system-prompt.repository';
import { SystemPromptService } from './system-prompt.service';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsRepository } from './system-settings.repository';
import { SystemSettingsService } from './system-settings.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SystemSettingsController, SystemPromptController],
  providers: [
    SystemSettingsRepository,
    SystemSettingsService,
    SystemPromptRepository,
    SystemPromptService,
  ],
  exports: [SystemSettingsService, SystemPromptService],
})
export class SystemSettingsModule {}
