import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import type { AgentRunDepthMode, AgentRunStatus, Prisma } from '../../../platform/prisma/generated';
import { computeExecutionPlan as buildExecutionPlan } from './execution-plan';

const ACTIVE_STATUSES: AgentRunStatus[] = [
  'pending', 'running', 'paused_user_confirm', 'paused_user_stop', 'paused_failure',
];

@Injectable()
export class AgentWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveRun(conversationId: string) {
    return this.prisma.agent_runs.findFirst({
      where: { conversationId, status: { in: ACTIVE_STATUSES } },
      include: {
        steps: { orderBy: { startedAt: 'desc' } },
        stepArtifacts: { orderBy: { version: 'desc' } },
        workflow: { include: { steps: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
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

    return this.prisma.agent_runs.create({
      data: {
        conversationId: opts.conversationId,
        agentId: opts.agentId,
        workflowId: opts.workflowId,
        modelConfigId: opts.modelConfigId,
        targetStepKey: opts.targetStepKey,
        depthMode: opts.depthMode ?? 'standard',
        status: 'pending',
      },
    });
  }

  async updateRunStatus(runId: string, status: AgentRunStatus, currentStepKey?: string) {
    return this.prisma.agent_runs.update({
      where: { id: runId },
      data: {
        status,
        ...(currentStepKey !== undefined && { currentStepKey }),
      },
    });
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
    return this.prisma.agent_run_steps.create({
      data: {
        runId: opts.runId,
        stepKey: opts.stepKey,
        attempt: opts.attempt ?? 1,
        status: 'running',
        startedAt: new Date(),
      },
    });
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
    return this.prisma.agent_run_steps.update({
      where: { id: stepId },
      data: data as Prisma.agent_run_stepsUncheckedUpdateInput,
    });
  }

  async getWorkflowSteps(workflowId: string) {
    return this.prisma.agent_workflow_steps.findMany({
      where: { workflowId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getDefaultSystemWorkflow() {
    const workflow = await this.prisma.agent_workflows.findFirst({
      where: {
        isDefault: true,
        agent: { isSystem: true },
      },
      include: {
        agent: true,
        steps: { orderBy: { sortOrder: 'asc' } },
      },
    });
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
