import { Module } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaController } from './arena.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { ChatFeatureGuard } from '../common/chat-feature.guard';

@Module({
  imports: [PrismaModule, ModelConfigModule, SystemSettingsModule],
  providers: [ArenaService, ChatFeatureGuard],
  controllers: [ArenaController],
  exports: [ArenaService],
})
export class ArenaModule {}
