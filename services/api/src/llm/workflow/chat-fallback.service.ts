import { Injectable } from '@nestjs/common';
import { createChatModelFromDbConfig } from '../model.factory';
import { ModelConfigService } from '../../model-config/model-config.service';
import { CallBillingService } from '../billing/call-billing.service';
import { createTrackedModel } from '../billing/llm-call-tracker';
import { ModelType } from '../../prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { WorkflowStepEvent } from './workflow.types';

@Injectable()
export class ChatFallbackService {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly billing: CallBillingService,
  ) {}

  async *chat(
    userId: string,
    message: string,
    modelConfigId?: string,
    images?: string[],
  ): AsyncGenerator<WorkflowStepEvent> {
    const resolvedId = modelConfigId ?? (await this.resolveDefaultModelId());
    const dbConfig = await this.modelConfigService.getConfigForOrchestrator(resolvedId);
    const model = createChatModelFromDbConfig(dbConfig);

    const isOwnModel = (dbConfig as any).createdBy === userId;
    const pointCostWeight = Number((dbConfig as any).pointCostWeight ?? 1);
    const invokeModel = isOwnModel
      ? model
      : createTrackedModel(model, this.billing, {
          userId,
          modelConfigId: resolvedId,
          modelName: (dbConfig as any).model ?? (dbConfig as any).name,
          modelProvider: (dbConfig as any).provider,
          modelTier: this.resolveBillingTier(dbConfig),
          pointCostWeight,
        });

    const result = await invokeModel.invoke([
      new SystemMessage('你是一个智能助手，请根据用户的问题给出简洁、准确的回答。'),
      this.buildUserMessage(message, images),
    ]);

    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

    yield { type: 'llm_token', stepKey: 'chat', content };
  }

  private async resolveDefaultModelId(): Promise<string> {
    const m = await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!m) throw new Error('未配置默认模型');
    return m.id;
  }

  private buildUserMessage(message: string, images?: string[]): HumanMessage {
    if (!images?.length) return new HumanMessage(message);

    return new HumanMessage({
      content: [
        { type: 'text', text: message },
        ...images.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    });
  }

  private resolveBillingTier(config: unknown): string | undefined {
    const metadata = (config as any)?.metadata;
    const tier = metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>).billingTier
      : undefined;
    return typeof tier === 'string' ? tier : undefined;
  }
}
