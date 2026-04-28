import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { createChatModelFromDbConfig } from './model.factory';
import { ModelConfigService } from '../model-config/model-config.service';
import { ModelType } from '@prisma/client';
import { GENERAL_ASSISTANT_SYSTEM } from './prompts';

@Injectable()
export class LlmService {
  private model: ChatOpenAI | null = null;

  constructor(private readonly modelConfigService: ModelConfigService) {}

  private async getModel(): Promise<ChatOpenAI> {
    if (this.model) return this.model;
    const defaultConfig = await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!defaultConfig) {
      throw new Error('未配置默认模型，请在模型配置中设置一个默认的 general 类型模型');
    }
    this.model = createChatModelFromDbConfig(defaultConfig);
    return this.model;
  }

  async createChain() {
    const model = await this.getModel();
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', GENERAL_ASSISTANT_SYSTEM],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);

    return prompt.pipe(model);
  }
}
