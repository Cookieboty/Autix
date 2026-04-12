import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [PrismaModule, MessageModule, LlmModule, DocumentModule],
  providers: [ConversationService],
  controllers: [ConversationController],
})
export class ConversationModule {}
