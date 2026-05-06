import { Injectable } from '@nestjs/common';
import { ModelType } from '@prisma/client';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../../model-config/model-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createChatModelFromDbConfig } from '../model.factory';
import type { SourceImageRef } from './image-generation-flow.service';
import type { WorkflowStepEvent } from './workflow.types';

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

    const result = await model.invoke([
      new SystemMessage(
        [
          `你是一个图片创意助手。用户正在使用图片模板「${input.template.title}」。`,
          `模板提示词模板: ${input.template.prompt}`,
          `模板变量定义: ${JSON.stringify(input.template.variables ?? [])}`,
          input.template.modelHint ? `默认图片模型: ${input.template.modelHint}` : '',
          sourceImages ? `用户已选择这些历史图片作为编辑源:\n${sourceImages}` : '',
          '你有三种回复模式:',
          '1. 用户在描述新图需求时，输出 JSON: {"type":"prompt_suggestion","prompt":"...","model":"...","reasoning":"..."}',
          '2. 用户已选择历史图片并描述修改点时，输出 JSON: {"type":"edit_suggestion","instruction":"...","model":"...","reasoning":"..."}',
          '3. 用户在咨询或讨论时，输出普通文字。',
          '除 JSON 模式外，不要包裹 Markdown 代码块。',
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
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
