import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { createChatModel } from '../model.factory';
import {
  RunnableWithMessageHistory,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { trimMessages } from '@langchain/core/messages';
import { BaseMessage } from '@langchain/core/messages';

@Injectable()
export class RunnableMemoryService {
  private model: ChatOpenAI;
  private messageHistories: Map<string, InMemoryChatMessageHistory>;
  private chainWithHistory!: RunnableWithMessageHistory<any, any>;
  private chainWithTrimming!: RunnableWithMessageHistory<any, any>;

  constructor() {
    this.model = createChatModel();
    this.messageHistories = new Map();

    // Initialize chains
    this.initializeChains();
  }

  private initializeChains() {
    // Prompt template for e-commerce customer service
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是一个专业的电商客服助手。你的职责是：
1. 理解客户的问题和需求
2. 记住客户在对话中提供的信息（如订单号、商品信息等）
3. 根据上下文提供准确的帮助
4. 对于退货请求，需要订单号才能判断是否可以退货

请保持友好、专业的态度。`,
      ],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);

    // Basic chain with full history
    const chain = prompt.pipe(this.model);

    this.chainWithHistory = new RunnableWithMessageHistory({
      runnable: chain,
      getMessageHistory: (sessionId: string) => this.getOrCreateHistory(sessionId),
      inputMessagesKey: 'input',
      historyMessagesKey: 'history',
    });

    // Chain with message trimming
    const trimmer = trimMessages({
      maxTokens: 2000,
      strategy: 'last',
      tokenCounter: (msgs: BaseMessage[]) => msgs.length,
    });

    const chainWithTrim = RunnablePassthrough.assign({
      history: async (input: any) => {
        const history = await this.getOrCreateHistory(input.sessionId);
        const messages = await history.getMessages();
        return trimmer.invoke(messages);
      },
    })
      .pipe(prompt)
      .pipe(this.model);

    this.chainWithTrimming = new RunnableWithMessageHistory({
      runnable: chainWithTrim,
      getMessageHistory: (sessionId: string) => this.getOrCreateHistory(sessionId),
      inputMessagesKey: 'input',
      historyMessagesKey: 'history',
    });
  }

  private getOrCreateHistory(sessionId: string): InMemoryChatMessageHistory {
    if (!this.messageHistories.has(sessionId)) {
      this.messageHistories.set(sessionId, new InMemoryChatMessageHistory());
    }
    return this.messageHistories.get(sessionId)!;
  }

  /**
   * Chat with full message history
   */
  async chat(sessionId: string, input: string): Promise<string> {
    const response = await this.chainWithHistory.invoke(
      { input },
      { configurable: { sessionId } }
    );
    return response.content.toString();
  }

  /**
   * Chat with trimmed message history (maxTokens: 2000, strategy: 'last')
   */
  async chatWithTrimming(sessionId: string, input: string): Promise<string> {
    const response = await this.chainWithTrimming.invoke(
      { input, sessionId },
      { configurable: { sessionId } }
    );
    return response.content.toString();
  }

  /**
   * Get message history for a session
   */
  async getHistory(sessionId: string): Promise<BaseMessage[]> {
    const history = this.getOrCreateHistory(sessionId);
    return history.getMessages();
  }

  /**
   * Append a message pair to history (for manual control)
   */
  async appendMessage(
    sessionId: string,
    human: string,
    ai: string
  ): Promise<void> {
    const history = this.getOrCreateHistory(sessionId);
    await history.addUserMessage(human);
    await history.addAIMessage(ai);
  }

  /**
   * Clear session history
   */
  async clearSession(sessionId: string): Promise<void> {
    const history = this.getOrCreateHistory(sessionId);
    await history.clear();
  }
}
