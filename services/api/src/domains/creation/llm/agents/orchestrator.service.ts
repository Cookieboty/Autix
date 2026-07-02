import { Injectable } from '@nestjs/common';
import { ModelConfigService } from '../../model-config/model-config.service';
import { hasImageCapability } from '@autix/domain';
import { AgentKind, ModelType } from '../../../platform/prisma/generated';
import { SearchService } from '../../document/search.service';
import { CallBillingService } from '../billing/call-billing.service';
import { AgentWorkflowService } from '../workflow/agent-workflow.service';
import { ChatFallbackService } from '../workflow/chat-fallback.service';
import { ImageChatService } from '../workflow/image-chat.service';
import { VideoChatService } from '../../video/video-chat.service';
import type {
  ImageGenerationSettings,
  SourceImageRef,
} from '../workflow/image-generation-flow.service';
import { classifyIntent } from '../workflow/intent-classifier';
import {
  executeStep,
  toRuntimeModelConfig,
  type RuntimeModelConfig,
} from '../workflow/workflow-step-executor';
import { createChatModelFromDbConfig } from '../model.factory';
import type { WorkflowStepEvent } from '../workflow/workflow.types';
import { SystemSettingsService } from '../../../platform/system-settings/system-settings.service';
import { SystemPromptService } from '../../../platform/system-settings/system-prompt.service';
import { LlmRepository } from '../llm.repository';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly repository: LlmRepository,
    private readonly searchService: SearchService,
    private readonly billing: CallBillingService,
    private readonly workflowService: AgentWorkflowService,
    private readonly chatFallback: ChatFallbackService,
    private readonly imageChatService: ImageChatService,
    private readonly videoChatService: VideoChatService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly systemPromptService: SystemPromptService,
  ) {}

  async *streamOrchestrate(
    input: string,
    retrievedContext: string,
    userId: string,
    conversationId: string,
    modelConfigId?: string,
    options?: {
      images?: string[];
      chatModelId?: string;
      sourceImages?: SourceImageRef[];
      imageSettings?: ImageGenerationSettings;
    },
  ): AsyncGenerator<WorkflowStepEvent> {
    const resolvedModelId = modelConfigId ?? await this.resolveDefaultModelId(userId);
    const conversation = await this.repository.findConversationKind(conversationId);
    const conversationKind = conversation?.kind ?? AgentKind.chat;

    const imageTemplate =
      conversationKind === AgentKind.image
        ? await this.getAttachedImageTemplate(conversationId)
        : null;
    if (conversationKind === AgentKind.image) {
      yield* this.imageChatService.chat({
        userId,
        conversationId,
        message: input,
        template: imageTemplate ?? await this.getImageToolPassthroughTemplate(userId),
        imageModelConfigId: resolvedModelId,
        chatModelConfigId: options?.chatModelId,
        sourceImages: options?.sourceImages,
        referenceImages: options?.images?.length
          ? options.images.map((url) => ({ url }))
          : undefined,
        settings: options?.imageSettings,
      });
      return;
    }

    const videoProject =
      conversationKind === AgentKind.video
        ? await this.getOrCreateVideoProject(conversationId, userId)
        : null;
    if (videoProject) {
      yield* this.videoChatService.chat({
        userId,
        conversationId,
        message: input,
        projectId: videoProject.id,
        modelConfigId: resolvedModelId,
      });
      return;
    }

    const dbConfig = toRuntimeModelConfig(
      await this.modelConfigService.getConfigForOrchestrator(resolvedModelId, userId),
    );
    const model = createChatModelFromDbConfig(dbConfig);

    // 1. Check for active run
    const activeRun = await this.workflowService.getActiveRun(conversationId);

    // 2. Intent classification
    const intentPrompt = await this.systemPromptService.render('workflow.intentClassifier', {
      hasActiveRun: String(!!activeRun),
      lastStepKey: activeRun?.currentStepKey ?? '',
    });
    const intent = await classifyIntent(
      model,
      input,
      !!activeRun,
      activeRun?.currentStepKey ?? undefined,
      intentPrompt.content,
    );

    yield {
      type: 'log',
      level: 'info',
      message: `意图分类结果: ${intent}`,
      data: { intent, hasActiveRun: !!activeRun },
    };

    // 3. Route based on intent
    switch (intent) {
      case 'normal_chat': {
        const imageModelId = await this.resolveDefaultImageModelId(userId);
        yield* this.chatFallback.chat(userId, input, resolvedModelId, options?.images, {
          imageTool: imageModelId
            ? {
              conversationId,
              imageModelConfigId: imageModelId,
              template: await this.getImageToolPassthroughTemplate(userId),
              sourceImages: options?.sourceImages,
              referenceImages: options?.images?.length
                ? options.images.map((url) => ({ url }))
                : undefined,
              settings: options?.imageSettings,
            }
            : undefined,
        });
        return;
      }

      case 'workflow_trigger':
        yield* this.handleWorkflowTrigger(userId, conversationId, input, resolvedModelId, dbConfig);
        return;

      case 'continue_run':
        if (activeRun) {
          yield* this.handleContinueRun(userId, activeRun, input, dbConfig);
        } else {
          yield* this.chatFallback.chat(userId, input, resolvedModelId, options?.images);
        }
        return;
    }
  }

  private async *handleWorkflowTrigger(
    userId: string,
    conversationId: string,
    input: string,
    modelConfigId: string,
    dbConfig: RuntimeModelConfig,
  ): AsyncGenerator<WorkflowStepEvent> {
    const workflow = await this.workflowService.getDefaultSystemWorkflow();
    if (!workflow) {
      yield* this.chatFallback.chat(userId, input, modelConfigId);
      return;
    }

    const run = await this.workflowService.createRun({
      conversationId,
      agentId: workflow.agentId,
      workflowId: workflow.id,
      modelConfigId,
    });

    yield {
      type: 'run_started',
      runId: run.id,
      agentId: workflow.agentId,
      workflowId: workflow.id,
      depthMode: run.depthMode,
    };

    const executionPlan = this.workflowService.computeExecutionPlan(
      workflow.steps,
      run.targetStepKey,
    );

    if (executionPlan.length === 0) {
      yield { type: 'log', level: 'error', message: '执行计划为空' };
      return;
    }

    // Execute first step
    const firstStepKey = executionPlan[0];
    await this.workflowService.updateRunStatus(run.id, 'running', firstStepKey);

    const stepDef = workflow.steps.find((s) => s.stepKey === firstStepKey);
    if (!stepDef) {
      yield { type: 'step_failed', stepKey: firstStepKey, error: 'Step 定义不存在' };
      return;
    }

    const runStep = await this.workflowService.createRunStep({
      runId: run.id,
      stepKey: firstStepKey,
    });

    const remaining = executionPlan.slice(1).map((key) => {
      const s = workflow.steps.find((ws) => ws.stepKey === key)!;
      return { stepKey: s.stepKey, displayName: s.displayName, isOptional: s.isOptional };
    });

    const runtimeConfig = toRuntimeModelConfig(dbConfig);

    const libraryEnabled = await this.systemSettingsService.getBoolean('features.libraryEnabled');

    yield* executeStep(
      {
        repository: this.repository,
        searchService: this.searchService,
        billing: this.billing,
        systemPromptService: this.systemPromptService,
        libraryEnabled,
      },
      run,
      stepDef,
      userId,
      input,
      remaining,
      0,
      executionPlan.length,
      runtimeConfig,
    );

    // Pause after first step for user confirmation
    await this.workflowService.updateRunStatus(run.id, 'paused_user_confirm', firstStepKey);
    yield { type: 'run_paused', reason: 'user_confirm' };
  }

  private async *handleContinueRun(
    userId: string,
    activeRun: Awaited<ReturnType<AgentWorkflowService['getActiveRun']>>,
    input: string,
    dbConfig: RuntimeModelConfig,
  ): AsyncGenerator<WorkflowStepEvent> {
    if (!activeRun) return;
    const workflow = activeRun.workflow;
    const executionPlan = this.workflowService.computeExecutionPlan(
      workflow.steps,
      activeRun.targetStepKey,
    );

    // Find next step after current
    const currentIdx = activeRun.currentStepKey
      ? executionPlan.indexOf(activeRun.currentStepKey)
      : -1;
    if (currentIdx < 0 || currentIdx >= executionPlan.length - 1) {
      yield { type: 'run_completed' };
      await this.workflowService.updateRunStatus(activeRun.id, 'completed');
      return;
    }

    const nextStepKey = executionPlan[currentIdx + 1];
    const stepDef = workflow.steps.find((s) => s.stepKey === nextStepKey);
    if (!stepDef) {
      yield { type: 'step_failed', stepKey: nextStepKey, error: 'Step 定义不存在' };
      return;
    }

    await this.workflowService.updateRunStatus(activeRun.id, 'running', nextStepKey);

    const runStep = await this.workflowService.createRunStep({
      runId: activeRun.id,
      stepKey: nextStepKey,
    });

    const remaining = executionPlan.slice(currentIdx + 2).map((key) => {
      const s = workflow.steps.find((ws) => ws.stepKey === key)!;
      return { stepKey: s.stepKey, displayName: s.displayName, isOptional: s.isOptional };
    });

    const runtimeConfig = toRuntimeModelConfig(dbConfig);

    const libraryEnabled = await this.systemSettingsService.getBoolean('features.libraryEnabled');

    yield* executeStep(
      {
        repository: this.repository,
        searchService: this.searchService,
        billing: this.billing,
        systemPromptService: this.systemPromptService,
        libraryEnabled,
      },
      activeRun,
      stepDef,
      userId,
      input,
      remaining,
      currentIdx + 1,
      executionPlan.length,
      runtimeConfig,
    );

    if (currentIdx + 2 >= executionPlan.length) {
      await this.workflowService.updateRunStatus(activeRun.id, 'completed');
      yield { type: 'run_completed' };
    } else {
      await this.workflowService.updateRunStatus(activeRun.id, 'paused_user_confirm', nextStepKey);
      yield { type: 'run_paused', reason: 'user_confirm' };
    }
  }

  private async resolveDefaultModelId(userId: string): Promise<string> {
    const m = await this.modelConfigService.findDefaultByTypeForUser(ModelType.general, userId);
    if (!m) throw new Error('未配置默认模型');
    return m.id;
  }

  private async resolveDefaultImageModelId(userId: string): Promise<string | undefined> {
    const available = await this.modelConfigService.findAvailableModels(userId);
    return available.find((model) =>
      hasImageCapability(model.capabilities ?? []),
    )?.id;
  }

  private async getAttachedImageTemplate(conversationId: string) {
    return this.repository.findAttachedImageTemplate(conversationId);
  }

  private async getImageToolPassthroughTemplate(userId: string) {
    return this.repository.ensureImageToolPassthroughTemplate(userId);
  }

  private async getOrCreateVideoProject(conversationId: string, userId: string) {
    const conversation = await this.repository.findVideoConversation(conversationId);
    if (conversation?.kind !== AgentKind.video) return null;

    const existing = await this.repository.findVideoProjectByConversation(conversationId);
    if (existing) return existing;

    return this.repository.createVideoProjectForConversation({
      userId,
      title: conversation?.title ?? '新视频项目',
      conversationId,
    });
  }
}
