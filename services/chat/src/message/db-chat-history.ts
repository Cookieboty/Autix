import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { MessageService } from './message.service';
import { MessageRole } from '@prisma/client';

export class DbChatHistory extends BaseListChatMessageHistory {
  lc_namespace = ['chat', 'db'];

  constructor(
    private readonly conversationId: string,
    private readonly messageService: MessageService,
  ) {
    super();
  }

  async getMessages(): Promise<BaseMessage[]> {
    return this.messageService.getHistoryAsLangChainMessages(this.conversationId);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const role =
      message instanceof HumanMessage ? MessageRole.USER : MessageRole.ASSISTANT;
    await this.messageService.addMessage(
      this.conversationId,
      role,
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
    );
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const m of messages) {
      await this.addMessage(m);
    }
  }

  async clear(): Promise<void> {
    await this.messageService.clearHistory(this.conversationId);
  }
}
