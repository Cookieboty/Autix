import { Injectable } from '@nestjs/common';
import { ModelType } from '../../prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../../model-config/model-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createChatModelFromDbConfig } from '../model.factory';
import type { SourceImageRef } from './image-generation-flow.service';
import type { WorkflowStepEvent } from './workflow.types';
import { SystemPromptService } from '../../system-settings/system-prompt.service';

export interface ImageTemplateContext {
  id: string;
  title: string;
  prompt: string;
  variables?: unknown;
  modelHint?: string | null;
}

export interface ImageChatInput {
  userId: string;
  conversationId: string;
  message: string;
  template: ImageTemplateContext;
  modelConfigId?: string;
  sourceImages?: SourceImageRef[];
}

@Injectable()
export class ImageChatService {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly prisma: PrismaService,
    private readonly systemPromptService: SystemPromptService,
  ) {}

  async *chat(input: ImageChatInput): AsyncGenerator<WorkflowStepEvent> {
    const text = await this.invokeAssistant(input);
    const parsed = this.parseStructuredResponse(text, input.sourceImages ?? []);

    if (parsed) {
      yield parsed;
      return;
    }

    yield { type: 'llm_token', stepKey: 'image_chat', content: text };
  }

  async invokeAssistant(input: ImageChatInput): Promise<string> {
    const config = input.modelConfigId
      ? await this.modelConfigService.getConfigForOrchestrator(input.modelConfigId)
      : await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!config) throw new Error('未配置通用模型');

    const history = await this.prisma.messages.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    const model = createChatModelFromDbConfig(config);
    const sourceImages = (input.sourceImages ?? [])
      .map((image, index) => `${index + 1}. ${image.url}${image.prompt ? ` | prompt: ${image.prompt}` : ''}`)
      .join('\n');

    const systemPrompt = await this.systemPromptService.render('image.templateChat', {
      templateTitle: input.template.title,
      templatePrompt: input.template.prompt,
      templateVariables: JSON.stringify(input.template.variables ?? []),
      modelHint: input.template.modelHint ? `默认图片模型: ${input.template.modelHint}` : '',
      sourceImages: sourceImages ? `用户已选择这些历史图片作为编辑源:\n${sourceImages}` : '',
    });

    const result = await model.invoke([
      new SystemMessage(systemPrompt.content),
      new HumanMessage(
        [
          `最近历史:\n${history.map((m) => `${m.role}: ${m.content}`).join('\n').slice(-6000)}`,
          `用户最新消息: ${input.message}`,
        ].join('\n\n'),
      ),
    ]);

    return typeof result.content === 'string'
      ? result.content.trim()
      : JSON.stringify(result.content);
  }

  private parseStructuredResponse(
    text: string,
    sourceImages: SourceImageRef[],
  ): WorkflowStepEvent | null {
    const jsonText = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      if (
        parsed.type === 'prompt_suggestion' &&
        typeof parsed.prompt === 'string'
      ) {
        return {
          type: 'prompt_suggestion',
          prompt: parsed.prompt,
          model: typeof parsed.model === 'string' ? parsed.model : 'gpt-image-2',
          reasoning:
            typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        };
      }

      if (
        parsed.type === 'edit_suggestion' &&
        typeof parsed.instruction === 'string'
      ) {
        return {
          type: 'edit_suggestion',
          instruction: parsed.instruction,
          sourceImages,
          model: typeof parsed.model === 'string' ? parsed.model : 'gpt-image-2',
          reasoning:
            typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        };
      }
    } catch {
      return null;
    }

    return null;
  }
}
