import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AgentRunDepthMode, AgentRunStatus, Prisma } from '../../prisma/generated';

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
    const stepMap = new Map(allSteps.map((s) => [s.stepKey, s]));

    if (targetStepKey && stepMap.has(targetStepKey)) {
      // 收集 target 及其所有依赖（递归）
      const needed = new Set<string>();
      const collect = (key: string) => {
        if (needed.has(key)) return;
        needed.add(key);
        const step = stepMap.get(key);
        if (step) {
          for (const dep of step.dependencies) {
            collect(dep);
          }
        }
      };
      collect(targetStepKey);

      return this.topoSort(
        allSteps.filter((s) => needed.has(s.stepKey)),
      );
    }

    // 无 target：执行所有非可选 step + 可选 step（用户可跳过）
    return this.topoSort(allSteps);
  }

  private topoSort(
    steps: Array<{ stepKey: string; dependencies: string[] }>,
  ): string[] {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    const stepSet = new Set(steps.map((s) => s.stepKey));

    for (const s of steps) {
      inDegree.set(s.stepKey, 0);
      adj.set(s.stepKey, []);
    }

    for (const s of steps) {
      for (const dep of s.dependencies) {
        if (stepSet.has(dep)) {
          adj.get(dep)!.push(s.stepKey);
          inDegree.set(s.stepKey, (inDegree.get(s.stepKey) ?? 0) + 1);
        }
      }
    }

    const queue = [...inDegree.entries()]
      .filter(([, d]) => d === 0)
      .map(([k]) => k);
    const result: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const next of adj.get(current) ?? []) {
        const newDegree = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, newDegree);
        if (newDegree === 0) queue.push(next);
      }
    }

    return result;
  }
}
