import { Injectable, Logger } from '@nestjs/common';
import { MessageRole, ModelType, VideoClipStatus } from '../../platform/prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../model-config/model-config.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { createChatModelFromDbConfig } from '../llm/model.factory';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';
import { SystemPromptService } from '../../platform/system-settings/system-prompt.service';

export interface VideoChatInput {
  userId: string;
  conversationId?: string;
  message: string;
  projectId: string;
  modelConfigId?: string;
  templateContext?: VideoDirectorTemplateContext;
}

export interface VideoDirectorTemplateContext {
  templateId: string;
  templateKind: 'workflow' | 'standard';
  title: string;
  category?: string | null;
  description?: string | null;
  prompt?: string;
  defaultParams?: Record<string, unknown> | null;
  tags?: string[];
  clips?: Array<{
    order: number;
    title?: string;
    promptTemplate: string;
    defaultParams: Record<string, unknown>;
    chainFromPrevious: boolean;
  }>;
}

type ParsedVideoAction = {
  action?: string;
  clipOrder?: number;
  title?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  chainFromPrevious?: boolean;
  chainFromPrev?: boolean;
  reasoning?: string;
  clips?: ParsedVideoAction[];
};

@Injectable()
export class VideoChatService {
  private readonly logger = new Logger(VideoChatService.name);

  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly prisma: PrismaService,
    private readonly systemPromptService: SystemPromptService,
  ) {}

  async *chat(input: VideoChatInput): AsyncGenerator<WorkflowStepEvent> {
    const text = await this.invokeAssistant(input);
    const parsed = this.parseVideoActions(text);

    if (parsed.length > 0) {
      const content = await this.applyVideoActions(input, parsed);
      await this.persistConversationTurn(input, content, {
        parsedActionCount: parsed.length,
        action: 'storyboard',
      });
      yield {
        type: 'llm_token',
        stepKey: 'video_chat',
        content,
      };
      return;
    }

    await this.persistConversationTurn(input, text, { action: 'chat' });
    yield { type: 'llm_token', stepKey: 'video_chat', content: text };
  }

  private async invokeAssistant(input: VideoChatInput): Promise<string> {
    const config = input.modelConfigId
      ? await this.modelConfigService.getConfigForOrchestrator(input.modelConfigId)
      : await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!config) throw new Error('未配置通用模型');

    const history = input.conversationId
      ? await this.prisma.messages.findMany({
          where: { conversationId: input.conversationId },
          orderBy: { createdAt: 'asc' },
          take: 20,
        })
      : [];

    const project = await this.prisma.video_projects.findFirst({
      where: input.conversationId
        ? { conversationId: input.conversationId }
        : { id: input.projectId, userId: input.userId },
      include: {
        clips: { orderBy: { order: 'asc' }, include: { materials: true } },
      },
    });

    const projectContext = project
      ? this.buildProjectContext(project)
      : 'No project created yet.';

    const model = createChatModelFromDbConfig(config);

    const historyLines = history
      .slice(-10)
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n');
    const templateGuidance = input.templateContext
      ? this.buildTemplateGuidance(input.templateContext)
      : '';

    const systemPrompt = await this.systemPromptService.render('video.director', {
      language: 'auto',
      appName: 'Autix',
    });

    const result = await model.invoke([
      new SystemMessage(systemPrompt.content),
      new HumanMessage(
        [
          `Current project state:\n${projectContext}`,
          templateGuidance ? `Selected storyboard template:\n${templateGuidance}` : '',
          historyLines ? `Recent conversation:\n${historyLines}` : '',
          `User message: ${input.message}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
    ]);

    return typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content);
  }

  private buildProjectContext(project: {
    title: string;
    clips: Array<{
      order: number;
      title: string | null;
      prompt: string | null;
      params: unknown;
      status: string;
      materials: Array<{ role: string; url: string; name: string | null }>;
    }>;
  }): string {
    const lines = [`Project: ${project.title}`, `Clips: ${project.clips.length}`];

    for (const clip of project.clips) {
      const materials = clip.materials
        .map((m) => `${m.role}: ${m.name ?? m.url.slice(-20)}`)
        .join(', ');
      lines.push(
        `  Clip ${clip.order}: "${clip.title ?? 'untitled'}" [${clip.status}] prompt="${clip.prompt ?? ''}" materials=[${materials}]`,
      );
    }

    return lines.join('\n');
  }

  private buildTemplateGuidance(template: VideoDirectorTemplateContext): string {
    const lines = [
      `Template: ${template.title}`,
      `Type: ${template.templateKind === 'workflow' ? 'multi-clip storyboard' : 'video prompt template'}`,
      template.category ? `Category: ${template.category}` : '',
      template.description ? `Description: ${template.description}` : '',
      template.tags?.length ? `Tags: ${template.tags.join(', ')}` : '',
    ].filter(Boolean);

    if (template.templateKind === 'workflow' && template.clips?.length) {
      lines.push(
        'Use this exact clip structure as the storyboard frame. Return one JSON clip for each template clip. Adapt each clip prompt to the user message and preserve clipOrder, duration, ratio, resolution, generateAudio, and chainFromPrevious unless the user asks otherwise.',
      );
      for (const clip of template.clips) {
        lines.push(
          [
            `Clip ${clip.order}: ${clip.title ?? ''}`,
            `Prompt template: ${clip.promptTemplate}`,
            `Default params: ${JSON.stringify(clip.defaultParams ?? {})}`,
            `Chain from previous: ${clip.chainFromPrevious}`,
          ].join('\n'),
        );
      }
      return lines.join('\n');
    }

    lines.push(
      'Use this video template as the creative brief and turn it into a storyboard with clear clip titles, clipOrder, prompts, and generation parameters.',
    );
    if (template.prompt) lines.push(`Prompt template: ${template.prompt}`);
    if (template.defaultParams) lines.push(`Default params: ${JSON.stringify(template.defaultParams)}`);
    return lines.join('\n');
  }

  private async persistConversationTurn(
    input: VideoChatInput,
    assistantContent: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!input.conversationId) return;
    await this.prisma.$transaction([
      this.prisma.messages.create({
        data: {
          conversationId: input.conversationId,
          role: MessageRole.USER,
          content: input.message,
          metadata: {
            messageType: 'markdown',
            source: 'video_director',
            modelConfigId: input.modelConfigId,
          },
        },
      }),
      this.prisma.messages.create({
        data: {
          conversationId: input.conversationId,
          role: MessageRole.ASSISTANT,
          content: assistantContent,
          metadata: {
            messageType: 'markdown',
            source: 'video_director',
            modelConfigId: input.modelConfigId,
            ...metadata,
          },
        },
      }),
    ]);
  }

  private async applyVideoAction(
    input: VideoChatInput,
    action: ParsedVideoAction,
  ): Promise<string> {
    const actionName = action.action ?? 'clip_suggestion';
    const prompt =
      typeof action.prompt === 'string' && action.prompt.trim()
        ? action.prompt.trim()
        : undefined;
    const params =
      action.params && typeof action.params === 'object' && !Array.isArray(action.params)
        ? this.normalizeParams(action.params)
        : undefined;
    const title =
      typeof action.title === 'string' && action.title.trim()
        ? action.title.trim()
        : undefined;
    const chainFromPrev =
      typeof action.chainFromPrevious === 'boolean'
        ? action.chainFromPrevious
        : typeof action.chainFromPrev === 'boolean'
          ? action.chainFromPrev
          : undefined;
    const clipOrder =
      typeof action.clipOrder === 'number' && Number.isFinite(action.clipOrder)
        ? Math.max(1, Math.floor(action.clipOrder))
        : await this.nextClipOrder(input.projectId);

    const shouldUpsert =
      actionName === 'clip_suggestion' ||
      actionName === 'update_prompt' ||
      actionName === 'update_params' ||
      Boolean(prompt) ||
      Boolean(params);

    let changed = false;
    if (shouldUpsert) {
      const existing = await this.prisma.video_clips.findFirst({
        where: { projectId: input.projectId, order: clipOrder },
      });

      if (existing) {
        const existingParams =
          existing.params && typeof existing.params === 'object' && !Array.isArray(existing.params)
            ? (existing.params as Record<string, unknown>)
            : {};
        await this.prisma.video_clips.update({
          where: { id: existing.id },
          data: {
            ...(title ? { title } : {}),
            ...(prompt ? { prompt } : {}),
            ...(params ? { params: { ...existingParams, ...params } as object } : {}),
            ...(typeof chainFromPrev === 'boolean' ? { chainFromPrev } : {}),
          },
        });
      } else {
        await this.prisma.video_clips.create({
          data: {
            projectId: input.projectId,
            order: clipOrder,
            title: title ?? `镜头 ${clipOrder}`,
            prompt: prompt ?? '',
            params: (params ?? {
              duration: 5,
              ratio: '16:9',
              resolution: '1080p',
              generateAudio: true,
            }) as object,
            chainFromPrev: chainFromPrev ?? false,
            status: VideoClipStatus.pending,
          },
        });
      }
      changed = true;
    }

    const lines = [
      changed
        ? `已更新第 ${clipOrder} 个片段。`
        : `已整理第 ${clipOrder} 个片段的创作建议。`,
    ];
    if (prompt) lines.push(`Prompt：${prompt}`);
    if (params) lines.push(`参数：${JSON.stringify(params)}`);
    if (action.reasoning) lines.push(`说明：${action.reasoning}`);
    lines.push(
      actionName === 'ready_to_generate'
        ? '当前片段可以生成。你也可以先补充首帧、参考图、参考视频或音频素材。'
        : '你可以继续让我拆分镜头、调整参数，或在片段卡片里点击生成视频。',
    );
    return lines.join('\n');
  }

  private async applyVideoActions(
    input: VideoChatInput,
    actions: ParsedVideoAction[],
  ): Promise<string> {
    const results: string[] = [];
    for (const action of actions) {
      results.push(await this.applyVideoAction(input, action));
    }
    if (actions.length <= 1) return results.join('\n\n');
    return [`已生成 ${actions.length} 个分镜脚本。`, ...results].join('\n\n');
  }

  private async nextClipOrder(projectId: string): Promise<number> {
    const agg = await this.prisma.video_clips.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    return (agg._max.order ?? 0) + 1;
  }

  private normalizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const next = { ...params };
    if (next.generateAudio === undefined && next.generate_audio !== undefined) {
      next.generateAudio = next.generate_audio;
    }
    delete next.generate_audio;
    if (typeof next.duration === 'string') {
      const duration = Number(next.duration.replace(/s$/i, ''));
      if (Number.isFinite(duration)) next.duration = duration;
    }
    delete next.startTime;
    delete next.endTime;
    delete next.start;
    delete next.end;
    return next;
  }

  private parseVideoActions(text: string): ParsedVideoAction[] {
    const matches = Array.from(
      text.matchAll(/<video_action>\s*([\s\S]*?)\s*<\/video_action>/g),
    );
    if (matches.length === 0) return [];

    const actions: ParsedVideoAction[] = [];
    for (const match of matches) {
      try {
        const parsed = JSON.parse(match[1]) as ParsedVideoAction | ParsedVideoAction[];
        const list = Array.isArray(parsed) ? parsed : parsed.clips ?? [parsed];
        for (const item of list) {
          if (item && typeof item === 'object') actions.push(item);
        }
      } catch (err) {
        this.logger.warn(
          `Failed to parse <video_action> JSON: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return actions;
  }
}
