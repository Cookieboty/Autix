import { Injectable, ConflictException } from '@nestjs/common';
import type { AgentRunDepthMode, AgentRunStatus, Prisma } from '../../../platform/prisma/generated';
import { LlmRepository } from '../llm.repository';
import { computeExecutionPlan as buildExecutionPlan } from './execution-plan';

@Injectable()
export class AgentWorkflowService {
  constructor(private readonly repository: LlmRepository) {}

  async getActiveRun(conversationId: string) {
    return this.repository.findActiveRun(conversationId);
  }

  async createRun(opts: {
    conversationId: string;
    agentId: string;
    workflowId: string;
    modelConfigId: string;
    targetStepKey?: string;
    depthMode?: AgentRunDepthMode;
  }) {
    const existing = await this.getActiveRun(opts.conversationId);
    if (existing) {
      throw new ConflictException('该会话已有进行中的工作流');
    }

    return this.repository.createAgentRun(opts);
  }

  async updateRunStatus(runId: string, status: AgentRunStatus, currentStepKey?: string) {
    return this.repository.updateAgentRunStatus(runId, status, currentStepKey);
  }

  async archiveRun(runId: string) {
    return this.updateRunStatus(runId, 'archived');
  }

  async cancelRun(runId: string) {
    return this.updateRunStatus(runId, 'cancelled');
  }

  async createRunStep(opts: {
    runId: string;
    stepKey: string;
    attempt?: number;
  }) {
    return this.repository.createAgentRunStep(opts);
  }

  async updateRunStep(
    stepId: string,
    data: {
      status?: string;
      artifactStepId?: string;
      proposedNextStep?: string;
      proposalReasoning?: string;
      validationAttempts?: number;
      criticAttempts?: number;
      lastCriticScore?: number;
      lastCriticFeedback?: string;
      error?: string;
      completedAt?: Date;
    },
  ) {
    return this.repository.updateAgentRunStep(
      stepId,
      data as Prisma.agent_run_stepsUncheckedUpdateInput,
    );
  }

  async getWorkflowSteps(workflowId: string) {
    return this.repository.findWorkflowSteps(workflowId);
  }

  async getDefaultSystemWorkflow() {
    const workflow = await this.repository.findDefaultSystemWorkflow();
    return workflow;
  }

  /**
   * 根据 targetStepKey 和 dependencies 计算要执行的 steps（拓扑序）。
   */
  computeExecutionPlan(
    allSteps: Array<{ stepKey: string; dependencies: string[]; isOptional: boolean }>,
    targetStepKey?: string | null,
  ): string[] {
    return buildExecutionPlan(allSteps, targetStepKey);
  }
}
