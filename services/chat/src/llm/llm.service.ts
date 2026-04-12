import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createChatModel } from './model.factory';
import { GENERAL_ASSISTANT_SYSTEM } from './prompts';

@Injectable()
export class LlmService {
  private readonly model = createChatModel();

  createChain() {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', GENERAL_ASSISTANT_SYSTEM],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);

    return prompt.pipe(this.model);
  }
}
