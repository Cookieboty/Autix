import { Injectable } from '@nestjs/common';
import {
  AgentKind,
  ImageTemplateSource,
  MessageRole,
  Prisma,
  ResourceType,
  TemplateStatus,
  type AgentRunDepthMode,
  type AgentRunStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const ACTIVE_AGENT_RUN_STATUSES: AgentRunStatus[] = [
  'pending', 'running', 'paused_user_confirm', 'paused_user_stop', 'paused_failure',
];

const CHAT_IMAGE_TOOL_SYSTEM_KEY = 'chat-image-tool';

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
    const select = {
      id: true,
      title: true,
      prompt: true,
      variables: true,
      modelHint: true,
    } as const;
    const where = {
      authorId: userId,
      systemKey: CHAT_IMAGE_TOOL_SYSTEM_KEY,
    };

    const existing = await this.prisma.image_templates.findFirst({ where, select });
    if (existing) return existing;

    // find-or-create：并发首次访问靠 @@unique([authorId, systemKey]) 收敛,
    // 抢输一方命中 P2002 后重查抢赢那条,而不是把异常冒泡成 500。
    try {
      return await this.prisma.image_templates.create({
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
          systemKey: CHAT_IMAGE_TOOL_SYSTEM_KEY,
          runtimeReason: '对话图片工具内部直通模板',
        },
        select,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.prisma.image_templates.findFirst({ where, select });
        if (raced) return raced;
      }
      throw err;
    }
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
    width?: number | null;
    height?: number | null;
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
          width: input.width ?? null,
          height: input.height ?? null,
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
    }, {
      // Prisma 交互式事务默认 5s —— 这个事务是全项目最重的一个：**积分结算**
      // （confirmHoldWithinTx，好几条账本写）+ generation + 模板 useCount + 消息 +
      // 资产，每条都是一次远端库往返。默认值下它会在 5s 处被斩断。
      //
      // 而这里超时的代价不是「重试一次」：图**已经生成、已经传进对象存储、上游的钱
      // 已经花了**，事务一回滚，库里没有任何记录、hold 也没结算 —— 用户付了钱、看到
      // 500、图没了，对象存储里躺着一个孤儿文件。
      //
      // 结算与入库必须原子（不能让「扣了钱但没入库」或「入了库但没扣钱」发生），所以
      // 正确的做法是给足时间，而不是把结算挪出事务。
      timeout: 30_000,
      maxWait: 10_000,
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
