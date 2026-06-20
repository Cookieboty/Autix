import { Injectable } from '@nestjs/common';
import { MessageRole } from '../../platform/prisma/generated';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { MessageRepository } from './message.repository';

@Injectable()
export class MessageService {
  constructor(private readonly messageRepository: MessageRepository) {}

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.messageRepository.addMessage(conversationId, role, content, metadata);
  }

  async getHistory(conversationId: string, limit?: number) {
    return this.messageRepository.getHistory(conversationId, limit);
  }

  async getHistoryAsLangChainMessages(conversationId: string): Promise<BaseMessage[]> {
    const messages = await this.getHistory(conversationId);
    return messages.map((m) =>
      m.role === MessageRole.USER
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    );
  }

  async clearHistory(conversationId: string) {
    await this.messageRepository.clearHistory(conversationId);
  }
}
