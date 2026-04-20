import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { ArtifactModule } from '../artifact/artifact.module';
import { UIActionParser } from './ui-action.parser';
import { UIResponseService } from '../llm/ui-protocol/ui-response.service';

@Module({
  imports: [
    PrismaModule,
    MessageModule,
    LlmModule,
    DocumentModule,
    ModelConfigModule,
    forwardRef(() => ArtifactModule),
  ],
  providers: [
    ConversationService,
    UIActionParser,
    UIResponseService,
  ],
  controllers: [ConversationController],
  exports: [ConversationService],
})
export class ConversationModule {}
