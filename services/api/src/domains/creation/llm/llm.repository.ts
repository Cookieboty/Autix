import { Injectable } from '@nestjs/common';
import {
  AgentKind,
  ImageTemplateSource,
  MessageRole,
  ResourceType,
  TemplateStatus,
  type AgentRunDepthMode,
  type AgentRunStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const ACTIVE_AGENT_RUN_STATUSES: AgentRunStatus[] = [
  'pending', 'running', 'paused_user_confirm', 'paused_user_stop', 'paused_failure',
];

const CHAT_IMAGE_TOOL_TEMPLATE_EXTERNAL_ID = 'system:chat-image-tool';

type PersistedImageItemBase = {
  url: string;
  index: number;
  generationId: string;
  prompt: string;
  sourceImages?: unknown;
  referenceImages?: unknown;
};

@Injectable()
export class LlmRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserPoints(userId: string) {
    return this.prisma.user_points.findUnique({ where: { userId } });
  }

  findPointHold(holdId: string) {
    return this.prisma.point_holds.findUnique({ where: { id: holdId } });
  }

  findPendingAgentCallPointRecords(runId: string) {
    return this.prisma.points_records.findMany({
      where: { sourceId: runId, status: 'PENDING', source: 'AGENT_CALL' },
    });
  }

  findActiveRun(conversationId: string) {
    return this.prisma.agent_runs.findFirst({
      where: { conversationId, status: { in: ACTIVE_AGENT_RUN_STATUSES } },
      include: {
        steps: { orderBy: { startedAt: 'desc' } },
        stepArtifacts: { orderBy: { version: 'desc' } },
        workflow: { include: { steps: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
  }

  createAgentRun(opts: {
    conversationId: string;
    agentId: string;
    workflowId: string;
    modelConfigId: string;
    targetStepKey?: string;
    depthMode?: AgentRunDepthMode;
  }) {
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

  updateAgentRunStatus(runId: string, status: AgentRunStatus, currentStepKey?: string) {
    return this.prisma.agent_runs.update({
      where: { id: runId },
      data: {
        status,
        ...(currentStepKey !== undefined && { currentStepKey }),
      },
    });
  }

  createAgentRunStep(opts: {
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

  updateAgentRunStep(stepId: string, data: Prisma.agent_run_stepsUncheckedUpdateInput) {
    return this.prisma.agent_run_steps.update({
      where: { id: stepId },
      data,
    });
  }

  findWorkflowSteps(workflowId: string) {
    return this.prisma.agent_workflow_steps.findMany({
      where: { workflowId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findDefaultSystemWorkflow() {
    return this.prisma.agent_workflows.findFirst({
      where: {
        isDefault: true,
        agent: { isSystem: true },
      },
      include: {
        agent: true,
        steps: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  findConversationMessages(conversationId: string, take: number) {
    return this.prisma.messages.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  findAllConversationMessages(conversationId: string) {
    return this.prisma.messages.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findLatestWorkflowStepArtifacts(runId: string, stepKeys: string[]) {
    return this.prisma.workflow_step_artifacts.findMany({
      where: { runId, stepKey: { in: stepKeys } },
      orderBy: { version: 'desc' },
      distinct: ['stepKey'],
    });
  }

  findConversationResources(conversationId: string) {
    return this.prisma.conversation_resources.findMany({
      where: { conversationId },
      orderBy: { activatedAt: 'asc' },
    });
  }

  findSkillsByIds(skillIds: string[]) {
    return this.prisma.skills.findMany({
      where: { id: { in: skillIds } },
      select: { id: true, title: true, description: true, instructions: true },
    });
  }

  findSingleAgentsByIds(agentIds: string[]) {
    return this.prisma.agents.findMany({
      where: { id: { in: agentIds }, executionMode: 'single' },
      select: { id: true, title: true, description: true, systemPrompt: true, toolBindings: true },
    });
  }

  findMcpServersByIds(mcpIds: string[]) {
    return this.prisma.mcp_servers.findMany({
      where: { id: { in: mcpIds } },
      select: { id: true, serverName: true, transport: true, runtimeRequirement: true },
    });
  }

  createWorkflowStepArtifact(opts: {
    runId: string;
    stepKey: string;
    content: string;
    contentType: Prisma.workflow_step_artifactsCreateInput['contentType'];
    version: number;
  }) {
    return this.prisma.workflow_step_artifacts.create({
      data: {
        runId: opts.runId,
        stepKey: opts.stepKey,
        content: opts.content,
        contentType: opts.contentType,
        version: opts.version,
      },
    });
  }

  findModelConfig(modelConfigId: string) {
    return this.prisma.model_configs.findUnique({ where: { id: modelConfigId } });
  }

  findConversationKind(conversationId: string) {
    return this.prisma.conversations.findUnique({
      where: { id: conversationId },
      select: { kind: true },
    });
  }

  async findAttachedImageTemplate(conversationId: string) {
    const link = await this.prisma.conversation_resources.findFirst({
      where: {
        conversationId,
        resourceType: ResourceType.IMAGE_TEMPLATE,
      },
      orderBy: { activatedAt: 'desc' },
    });
    if (!link) return null;

    const template = await this.prisma.image_templates.findUnique({
      where: { id: link.resourceId },
      select: {
        id: true,
        title: true,
        prompt: true,
        variables: true,
        modelHint: true,
      },
    });

    return template
      ? {
          id: template.id,
          title: template.title,
          prompt: template.prompt,
          variables: template.variables,
          modelHint: template.modelHint,
        }
      : null;
  }

  findVideoConversation(conversationId: string) {
    return this.prisma.conversations.findUnique({
      where: { id: conversationId },
      select: { title: true, kind: true },
    });
  }

  findVideoProjectByConversation(conversationId: string) {
    return this.prisma.video_projects.findUnique({
      where: { conversationId },
    });
  }

  createVideoProjectForConversation(input: {
    userId: string;
    title: string;
    conversationId: string;
  }) {
    return this.prisma.video_projects.create({
      data: {
        userId: input.userId,
        title: input.title,
        conversationId: input.conversationId,
        status: 'draft',
      },
    });
  }

  /**
   * 确保存在一个图片工具直通模板。用于无模板图片会话和普通 chat 中的图片工具调用，
   * prompt 由主 LLM action 直接提供，不套模板文案。
   */
  async ensureImageToolPassthroughTemplate(userId: string): Promise<{
    id: string;
    title: string;
    prompt: string;
    variables: Prisma.JsonValue;
    modelHint: string | null;
  }> {
    const existing = await this.prisma.image_templates.findFirst({
      where: {
        authorId: userId,
        externalId: CHAT_IMAGE_TOOL_TEMPLATE_EXTERNAL_ID,
      },
      select: {
        id: true,
        title: true,
        prompt: true,
        variables: true,
        modelHint: true,
      },
    });
    if (existing) return existing;

    return this.prisma.image_templates.create({
      data: {
        title: '对话图片工具',
        description: '对话中由主 LLM 调用图片工具时使用的内部直通模板',
        category: 'chat-image',
        prompt: '{{prompt}}',
        variables: [{ key: 'prompt', label: 'Prompt', type: 'textarea', default: '' }],
        tags: ['chat-image-tool'],
        authorId: userId,
        status: TemplateStatus.ARCHIVED,
        createdById: userId,
        sourceType: ImageTemplateSource.SYSTEM,
        systemKey: 'chat-image-tool',
        externalId: CHAT_IMAGE_TOOL_TEMPLATE_EXTERNAL_ID,
        externalMetadata: { internal: true, chatImageTool: true },
        runtimeReason: '对话图片工具内部直通模板',
      },
      select: {
        id: true,
        title: true,
        prompt: true,
        variables: true,
        modelHint: true,
      },
    });
  }

  async createCompletedImageGenerationResult<
    TImageItem extends PersistedImageItemBase,
  >(input: {
    templateId: string;
    userId: string;
    modelUsed: string;
    resolvedPrompt: string;
    variables: Prisma.InputJsonValue;
    referenceImage?: string;
    generatedImages: string[];
    durationMs: number;
    conversationId?: string;
    conversationContent: string;
    buildImageItems: (generationId: string) => TImageItem[];
    buildMessageMetadata: (
      generationId: string,
      imageItems: TImageItem[],
    ) => Prisma.InputJsonValue;
  }, beforeCreate?: (tx: Prisma.TransactionClient) => Promise<void>) {
    return this.prisma.$transaction(async (tx) => {
      await beforeCreate?.(tx);

      const generation = await tx.image_generations.create({
        data: {
          templateId: input.templateId,
          userId: input.userId,
          modelUsed: input.modelUsed,
          resolvedPrompt: input.resolvedPrompt,
          variables: input.variables,
          referenceImage: input.referenceImage,
          generatedImages: input.generatedImages,
          status: 'completed',
          durationMs: input.durationMs,
        },
      });

      await tx.image_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      const imageItems = input.buildImageItems(generation.id);

      if (input.conversationId) {
        await tx.messages.create({
          data: {
            conversationId: input.conversationId,
            role: MessageRole.ASSISTANT,
            content: input.conversationContent,
            metadata: input.buildMessageMetadata(generation.id, imageItems),
          },
        });
      }

      return { generation, imageItems };
    });
  }
}

export type LlmContextRepository = Pick<
  LlmRepository,
  | 'findLatestWorkflowStepArtifacts'
  | 'findConversationResources'
  | 'findSkillsByIds'
  | 'findSingleAgentsByIds'
  | 'findMcpServersByIds'
>;

export type LlmWorkflowArtifactRepository = Pick<LlmRepository, 'createWorkflowStepArtifact'>;

export type LlmCriticModelRepository = Pick<LlmRepository, 'findModelConfig'>;
