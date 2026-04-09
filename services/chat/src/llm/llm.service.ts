import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createChatModel } from './model.factory';

@Injectable()
export class LlmService {
  private readonly model = createChatModel();

  createChain() {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个智能助手，请根据用户的问题给出简洁、准确的回答。'],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);

    return prompt.pipe(this.model);
  }
}
