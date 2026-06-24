import { Injectable, Logger } from '@nestjs/common';
import { ModelType, VideoClipStatus, type Prisma } from '../../platform/prisma/generated';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelConfigService } from '../model-config/model-config.service';
import { createChatModelFromDbConfig } from '../llm/model.factory';
import { estimateTextTokens, extractTokenUsage } from '../llm/billing/token-estimation';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';
import { PointsService } from '../../billing/points/points.service';
import { MembershipService } from '../../billing/membership/membership.service';
import { SystemPromptService } from '../../platform/system-settings/system-prompt.service';
import { VideoProjectRepository } from './video-project.repository';

export interface VideoChatInput {
  userId: string;
  conversationId?: string;
  message: string;
  projectId: string;
  modelConfigId?: string;
  templateContext?: VideoDirectorTemplateContext;
  billingPurpose?: VideoDirectorBillingPurpose;
}

export type VideoDirectorBillingPurpose =
  | 'video_template_optimize'
  | 'video_storyboard_optimize';

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

type VideoDirectorModelConfig = {
  id: string;
  model: string;
  provider?: string | null;
};

type PreparedAssistantInvocation = {
  config: VideoDirectorModelConfig;
  model: Awaited<ReturnType<typeof createChatModelFromDbConfig>>;
  messages: [SystemMessage, HumanMessage];
  inputTokens: number;
};

@Injectable()
export class VideoChatService {
  private readonly logger = new Logger(VideoChatService.name);

  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly repository: VideoProjectRepository,
    private readonly systemPromptService: SystemPromptService,
    private readonly pointsService: PointsService,
    private readonly membershipService: MembershipService,
  ) {}

  async *chat(input: VideoChatInput): AsyncGenerator<WorkflowStepEvent> {
    const prepared = await this.prepareAssistantInvocation(input);
    const hold = await this.createBillingHold(input, prepared.config, {
      inputTokens: prepared.inputTokens,
      outputTokens: Math.max(128, estimateTextTokens(input.message) * 2),
    });

    try {
      const result = await prepared.model.invoke(prepared.messages);
      const text = typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content);
      const parsed = this.parseVideoActions(text);

      if (parsed.length > 0) {
        const content = await this.applyVideoActions(input, parsed);
        await this.persistConversationTurn(input, content, {
          parsedActionCount: parsed.length,
          action: 'storyboard',
          billingPurpose: input.billingPurpose ?? null,
        });
        await this.confirmBillingHold(hold, prepared.config, result, content);
        yield {
          type: 'llm_token',
          stepKey: 'video_chat',
          content,
        };
        return;
      }

      await this.persistConversationTurn(input, text, {
        action: 'chat',
        billingPurpose: input.billingPurpose ?? null,
      });
      await this.confirmBillingHold(hold, prepared.config, result, text);
      yield { type: 'llm_token', stepKey: 'video_chat', content: text };
    } catch (err) {
      if (hold) await this.safeRefundBillingHold(hold.holdId, '视频导演任务失败');
      throw err;
    }
  }

  private async prepareAssistantInvocation(
    input: VideoChatInput,
  ): Promise<PreparedAssistantInvocation> {
    const config = input.modelConfigId
      ? await this.modelConfigService.getConfigForOrchestrator(input.modelConfigId, input.userId)
      : await this.modelConfigService.findDefaultByTypeForUser(ModelType.general, input.userId);
    if (!config) throw new Error('未配置通用模型');

    const history = input.conversationId
      ? await this.repository.findConversationMessages(input.conversationId)
      : [];

    const project = await this.repository.findVideoDirectorProject(input);

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

    const humanText =
      [
        `Current project state:\n${projectContext}`,
        templateGuidance ? `Selected storyboard template:\n${templateGuidance}` : '',
        historyLines ? `Recent conversation:\n${historyLines}` : '',
        `User message: ${input.message}`,
      ]
        .filter(Boolean)
        .join('\n\n');
    const messages: [SystemMessage, HumanMessage] = [
      new SystemMessage(systemPrompt.content),
      new HumanMessage(humanText),
    ];

    return {
      config,
      model,
      messages,
      inputTokens: estimateTextTokens(`${systemPrompt.content}\n\n${humanText}`),
    };
  }

  private async createBillingHold(
    input: VideoChatInput,
    config: VideoDirectorModelConfig,
    tokens: { inputTokens: number; outputTokens: number },
  ): Promise<{
    holdId: string;
    estimatedCost: number;
    inputTokens: number;
    taskType: VideoDirectorBillingPurpose;
    membershipLevel: number;
  } | null> {
    if (!input.billingPurpose) return null;
    const taskId = `video-director:${input.billingPurpose}:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const membershipLevel = await this.membershipService.resolveActiveMembershipLevel(input.userId);
    const estimate = await this.pointsService.estimateCost({
      taskType: input.billingPurpose,
      modelProvider: config.provider ?? undefined,
      modelName: config.model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      membershipLevel,
    });
    const { hold } = await this.pointsService.createHold(input.userId, {
      taskType: input.billingPurpose,
      taskId,
      amount: estimate.estimatedCost,
      pricingSnapshot: this.toJson(estimate.pricingSnapshot),
      refundPolicySnapshot: estimate.refundPolicy
        ? this.toJson(estimate.refundPolicy)
        : undefined,
      metadata: this.toJson({
        projectId: input.projectId,
        conversationId: input.conversationId ?? null,
        modelConfigId: config.id,
        modelName: config.model,
        inputTokens: tokens.inputTokens,
        estimatedOutputTokens: tokens.outputTokens,
        billingPurpose: input.billingPurpose,
        membershipLevel,
      }),
      remark: this.buildBillingRemark(input.billingPurpose, config),
    });
    return {
      holdId: hold.id,
      estimatedCost: estimate.estimatedCost,
      inputTokens: tokens.inputTokens,
      taskType: input.billingPurpose,
      membershipLevel,
    };
  }

  private async confirmBillingHold(
    hold: {
      holdId: string;
      estimatedCost: number;
      inputTokens: number;
      taskType: VideoDirectorBillingPurpose;
      membershipLevel?: number;
    } | null,
    config: VideoDirectorModelConfig,
    result: unknown,
    content: string,
  ) {
    if (!hold) return;
    const usage = extractTokenUsage(result);
    try {
      const actualEstimate = await this.pointsService.estimateCost({
        taskType: hold.taskType,
        modelProvider: config.provider ?? undefined,
        modelName: config.model,
        inputTokens: usage.inputTokens ?? hold.inputTokens,
        outputTokens: usage.outputTokens ?? estimateTextTokens(content),
        contextTokens: usage.contextTokens,
        membershipLevel: hold.membershipLevel,
      });
      await this.pointsService.confirmHold(
        hold.holdId,
        Math.min(actualEstimate.estimatedCost, hold.estimatedCost),
      );
    } catch {
      await this.pointsService.confirmHold(hold.holdId);
    }
  }

  private async safeRefundBillingHold(holdId: string, reason: string) {
    try {
      await this.pointsService.refundHold(holdId, reason);
    } catch (err) {
      this.logger.error(
        `video director point hold refund failed: hold=${holdId} reason=${String(
          err instanceof Error ? err.message : err,
        )}`,
      );
    }
  }

  private buildBillingRemark(
    purpose: VideoDirectorBillingPurpose,
    config: VideoDirectorModelConfig,
  ) {
    const model = [config.provider, config.model].filter(Boolean).join('/') || config.model;
    return purpose === 'video_storyboard_optimize'
      ? `视频分镜 AI 优化 · ${model}`
      : `视频模板 AI 优化 · ${model}`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
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
    await this.repository.persistVideoDirectorTurn({
      conversationId: input.conversationId,
      userMessage: input.message,
      assistantContent,
      modelConfigId: input.modelConfigId,
      metadata,
    });
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
      const existing = await this.repository.findClipAtOrder(
        input.projectId,
        clipOrder,
      );

      if (existing) {
        const existingParams =
          existing.params && typeof existing.params === 'object' && !Array.isArray(existing.params)
            ? (existing.params as Record<string, unknown>)
            : {};
        await this.repository.updateClip(existing.id, {
          ...(title ? { title } : {}),
          ...(prompt ? { prompt } : {}),
          ...(params
            ? { params: { ...existingParams, ...params } as Prisma.InputJsonValue }
            : {}),
          ...(typeof chainFromPrev === 'boolean' ? { chainFromPrev } : {}),
        });
      } else {
        await this.repository.createClip({
          projectId: input.projectId,
          order: clipOrder,
          title: title ?? `镜头 ${clipOrder}`,
          prompt: prompt ?? '',
          params: (params ?? {
            duration: 5,
            ratio: '16:9',
            resolution: '1080p',
            generateAudio: true,
          }) as Prisma.InputJsonValue,
          chainFromPrev: chainFromPrev ?? false,
          status: VideoClipStatus.pending,
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
    return this.repository.findNextClipOrder(projectId);
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
