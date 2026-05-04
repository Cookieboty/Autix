import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
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

@Module({
  imports: [
    PrismaModule,
    MessageModule,
    LlmModule,
    ModelConfigModule,
    forwardRef(() => ArtifactModule),
  ],
  providers: [
    ConversationService,
    ConversationResourcesService,
  ],
  controllers: [ConversationController, ConversationResourcesController],
  exports: [ConversationService, ConversationResourcesService],
})
export class ConversationModule {}
