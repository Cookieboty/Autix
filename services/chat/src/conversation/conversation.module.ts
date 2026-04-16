import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { UIActionParser } from './ui-action.parser';
import { UIResponseService } from '../llm/ui-protocol/ui-response.service';

@Module({
  imports: [PrismaModule, MessageModule, LlmModule, DocumentModule, ModelConfigModule],
  providers: [
    ConversationService,
    UIActionParser,
    UIResponseService,
  ],
  controllers: [ConversationController],
})
export class ConversationModule {}
