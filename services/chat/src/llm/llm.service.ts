import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createChatModel } from './model.factory';
import { loadLangChainConfig, getApiKeys } from '../config/load-langchain-config';
import { GENERAL_ASSISTANT_SYSTEM } from './prompts';

@Injectable()
export class LlmService {
  private readonly model = (() => {
    const config = loadLangChainConfig();
    const keys = getApiKeys();
    return createChatModel({
      modelConfigId: 'default',
      modelName: config.llm.model,
      temperature: config.llm.temperature,
      maxTokens: config.llm.maxTokens,
      baseUrl: keys.openaiBaseUrl,
      apiKey: keys.openaiApiKey,
    });
  })();

  createChain() {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', GENERAL_ASSISTANT_SYSTEM],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);

    return prompt.pipe(this.model);
  }
}
