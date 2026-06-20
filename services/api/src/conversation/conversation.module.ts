import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationMediaService } from './conversation-media.service';
import { ConversationResourcesService } from './conversation-resources.service';
import {
  ConversationController,
  ConversationResourcesController,
} from './conversation.controller';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { ArtifactModule } from '../artifact/artifact.module';
import { VideoModule } from '../video/video.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { ChatFeatureGuard } from '../common/chat-feature.guard';

@Module({
  imports: [
    PrismaModule,
    MessageModule,
    LlmModule,
    ModelConfigModule,
    VideoModule,
    SystemSettingsModule,
    forwardRef(() => ArtifactModule),
  ],
  providers: [
    ConversationService,
    ConversationMediaService,
    ConversationResourcesService,
    ChatFeatureGuard,
  ],
  controllers: [ConversationController, ConversationResourcesController],
  exports: [ConversationService, ConversationMediaService, ConversationResourcesService],
})
export class ConversationModule {}
