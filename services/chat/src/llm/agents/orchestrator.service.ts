import { Injectable } from '@nestjs/common';
import { ModelConfigService } from '../../model-config/model-config.service';
import { ModelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../../document/search.service';
import { CallBillingService } from '../billing/call-billing.service';
import { AgentWorkflowService } from '../workflow/agent-workflow.service';
import { ChatFallbackService } from '../workflow/chat-fallback.service';
import { classifyIntent } from '../workflow/intent-classifier';
import { executeStep } from '../workflow/workflow-step-executor';
import { createChatModelFromDbConfig } from '../model.factory';
import type { WorkflowStepEvent } from '../workflow/workflow.types';

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly billing: CallBillingService,
    private readonly workflowService: AgentWorkflowService,
    private readonly chatFallback: ChatFallbackService,
  ) {}

  async *streamOrchestrate(
    input: string,
    retrievedContext: string,
    userId: string,
    conversationId: string,
    modelConfigId?: string,
  ): AsyncGenerator<WorkflowStepEvent> {
    const resolvedModelId = modelConfigId ?? await this.resolveDefaultModelId();
    const dbConfig = await this.modelConfigService.getConfigForOrchestrator(resolvedModelId);
    const model = createChatModelFromDbConfig(dbConfig);

    // 1. Check for active run
    const activeRun = await this.workflowService.getActiveRun(conversationId);

    // 2. Intent classification
    const intent = await classifyIntent(
      model,
      input,
      !!activeRun,
      activeRun?.currentStepKey ?? undefined,
    );

    yield {
      type: 'log',
      level: 'info',
      message: `意图分类结果: ${intent}`,
      data: { intent, hasActiveRun: !!activeRun },
    };

    // 3. Route based on intent
    switch (intent) {
      case 'normal_chat':
        yield* this.chatFallback.chat(userId, input, resolvedModelId);
        return;

      case 'workflow_trigger':
        yield* this.handleWorkflowTrigger(userId, conversationId, input, resolvedModelId, dbConfig);
        return;

      case 'continue_run':
        if (activeRun) {
          yield* this.handleContinueRun(userId, activeRun, input, dbConfig);
        } else {
          yield* this.chatFallback.chat(userId, input, resolvedModelId);
        }
        return;
    }
  }

  private async *handleWorkflowTrigger(
    userId: string,
    conversationId: string,
    input: string,
    modelConfigId: string,
    dbConfig: any,
  ): AsyncGenerator<WorkflowStepEvent> {
    const workflow = await this.workflowService.getDefaultSystemWorkflow();
    if (!workflow) {
      yield { type: 'log', level: 'error', message: '未找到默认系统工作流' };
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

    const pointCostWeight = Number((dbConfig as any).pointCostWeight ?? 1);

    yield* executeStep(
      { prisma: this.prisma, searchService: this.searchService, billing: this.billing },
      run,
      stepDef,
      userId,
      input,
      remaining,
      0,
      executionPlan.length,
      { ...dbConfig, pointCostWeight },
    );

    // Pause after first step for user confirmation
    await this.workflowService.updateRunStatus(run.id, 'paused_user_confirm', firstStepKey);
    yield { type: 'run_paused', reason: 'user_confirm' };
  }

  private async *handleContinueRun(
    userId: string,
    activeRun: any,
    input: string,
    dbConfig: any,
  ): AsyncGenerator<WorkflowStepEvent> {
    const workflow = activeRun.workflow;
    const executionPlan = this.workflowService.computeExecutionPlan(
      workflow.steps,
      activeRun.targetStepKey,
    );

    // Find next step after current
    const currentIdx = executionPlan.indexOf(activeRun.currentStepKey);
    if (currentIdx < 0 || currentIdx >= executionPlan.length - 1) {
      yield { type: 'run_completed' };
      await this.workflowService.updateRunStatus(activeRun.id, 'completed');
      return;
    }

    const nextStepKey = executionPlan[currentIdx + 1];
    const stepDef = workflow.steps.find((s: any) => s.stepKey === nextStepKey);
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
      const s = workflow.steps.find((ws: any) => ws.stepKey === key)!;
      return { stepKey: s.stepKey, displayName: s.displayName, isOptional: s.isOptional };
    });

    const pointCostWeight = Number((dbConfig as any).pointCostWeight ?? 1);

    yield* executeStep(
      { prisma: this.prisma, searchService: this.searchService, billing: this.billing },
      activeRun,
      stepDef,
      userId,
      input,
      remaining,
      currentIdx + 1,
      executionPlan.length,
      { ...dbConfig, pointCostWeight },
    );

    if (currentIdx + 2 >= executionPlan.length) {
      await this.workflowService.updateRunStatus(activeRun.id, 'completed');
      yield { type: 'run_completed' };
    } else {
      await this.workflowService.updateRunStatus(activeRun.id, 'paused_user_confirm', nextStepKey);
      yield { type: 'run_paused', reason: 'user_confirm' };
    }
  }

  private async resolveDefaultModelId(): Promise<string> {
    const m = await this.modelConfigService.findDefaultByType(ModelType.general);
    if (!m) throw new Error('未配置默认模型');
    return m.id;
  }
}
