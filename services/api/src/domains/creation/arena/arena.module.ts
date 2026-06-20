import { Module } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaController } from './arena.controller';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { SystemSettingsModule } from '../../platform/system-settings/system-settings.module';
import { ChatFeatureGuard } from '../../platform/common/chat-feature.guard';

@Module({
  imports: [PrismaModule, ModelConfigModule, SystemSettingsModule],
  providers: [ArenaService, ChatFeatureGuard],
  controllers: [ArenaController],
  exports: [ArenaService],
})
export class ArenaModule {}
