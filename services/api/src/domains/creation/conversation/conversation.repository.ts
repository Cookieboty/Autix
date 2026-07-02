import { Injectable } from '@nestjs/common';
import {
  AgentKind,
  MessageRole,
  ResourceType,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAgentForConversation(agentId: string) {
    return this.prisma.agents.findUnique({
      where: { id: agentId },
      select: { id: true, kind: true },
    });
  }

  findAgentSystemFlag(agentId: string) {
    return this.prisma.agents.findUnique({
      where: { id: agentId },
      select: { isSystem: true },
    });
  }

  findAgentKind(agentId: string) {
    return this.prisma.agents.findUnique({
      where: { id: agentId },
      select: { kind: true },
    });
  }

  findAgentKindAndSystem(agentId: string) {
    return this.prisma.agents.findUnique({
      where: { id: agentId },
      select: { kind: true, isSystem: true },
    });
  }

  findFirstSystemSingleAgent(kind: AgentKind) {
    return this.prisma.agents.findFirst({
      where: { isSystem: true, kind, executionMode: 'single' },
      select: { id: true },
    });
  }

  findOldestSystemSingleAgent(kind: AgentKind) {
    return this.prisma.agents.findFirst({
      where: { isSystem: true, kind, executionMode: 'single' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  }

  createConversation(input: {
    userId: string;
    title: string;
    kind: AgentKind;
    agentId: string | null;
  }) {
    return this.prisma.conversations.create({
      data: input,
    });
  }

  findConversationsByUser(userId: string, kind?: AgentKind) {
    const where: Prisma.conversationsWhereInput = { userId };
    if (kind) where.kind = kind;

    return this.prisma.conversations.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        agent: { select: { id: true, title: true, kind: true } },
        videoProject: {
          select: {
            id: true,
            status: true,
            _count: { select: { clips: true } },
          },
        },
      },
    });
  }

  findConversationById(conversationId: string) {
    return this.prisma.conversations.findUnique({
      where: { id: conversationId },
    });
  }

  findConversationDetail(conversationId: string) {
    return this.prisma.conversations.findUnique({
      where: { id: conversationId },
      include: {
        agent: { select: { id: true, title: true, kind: true } },
        videoProject: {
          select: {
            id: true,
            status: true,
            title: true,
            coverImage: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { clips: true } },
          },
        },
      },
    });
  }

  findConversationOwner(conversationId: string) {
    return this.prisma.conversations.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
  }

  updateConversationKind(conversationId: string, kind: AgentKind) {
    return this.prisma.conversations.update({
      where: { id: conversationId },
      data: { kind },
    });
  }

  updateConversationTitle(conversationId: string, title: string) {
    return this.prisma.conversations.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  deleteConversation(conversationId: string) {
    return this.prisma.conversations.delete({ where: { id: conversationId } });
  }

  findVideoProjectByConversationId(conversationId: string) {
    return this.prisma.video_projects.findUnique({
      where: { conversationId },
      select: { id: true },
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

  findVideoProjectIdForUser(conversationId: string, userId: string) {
    return this.prisma.video_projects.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });
  }

  findUserResourceAcquisition(input: {
    userId: string;
    resourceType: ResourceType;
    resourceId: string;
  }) {
    return this.prisma.user_resource_acquisitions.findUnique({
      where: {
        userId_resourceType_resourceId: input,
      },
    });
  }

  findConversationResource(input: {
    conversationId: string;
    resourceType: ResourceType;
    resourceId: string;
  }) {
    return this.prisma.conversation_resources.findUnique({
      where: {
        conversationId_resourceType_resourceId: input,
      },
    });
  }

  findFirstConversationResource(
    conversationId: string,
    resourceType: ResourceType,
  ) {
    return this.prisma.conversation_resources.findFirst({
      where: { conversationId, resourceType },
    });
  }

  findFirstConversationResourceId(
    conversationId: string,
    resourceType: ResourceType,
  ) {
    return this.prisma.conversation_resources.findFirst({
      where: { conversationId, resourceType },
      select: { resourceId: true },
    });
  }

  createConversationResource(input: {
    conversationId: string;
    resourceType: ResourceType;
    resourceId: string;
    activatedBy: string;
  }) {
    return this.prisma.conversation_resources.create({
      data: input,
    });
  }

  deleteConversationResource(input: {
    conversationId: string;
    resourceType: ResourceType;
    resourceId: string;
  }) {
    return this.prisma.conversation_resources.delete({
      where: {
        conversationId_resourceType_resourceId: input,
      },
    });
  }

  countMessages(conversationId: string) {
    return this.prisma.messages.count({
      where: { conversationId },
    });
  }

  findConversationResources(conversationId: string) {
    return this.prisma.conversation_resources.findMany({
      where: { conversationId },
      orderBy: { activatedAt: 'asc' },
    });
  }

  async findPromptResources(input: {
    skillIds: string[];
    agentIds: string[];
    mcpIds: string[];
    imageTemplateIds: string[];
    videoTemplateIds: string[];
  }) {
    const [skills, agents, mcps, imageTemplates, videoTemplates] =
      await Promise.all([
        input.skillIds.length > 0
          ? this.prisma.skills.findMany({
              where: { id: { in: input.skillIds } },
              select: { id: true, title: true, instructions: true },
            })
          : Promise.resolve([]),
        input.agentIds.length > 0
          ? this.prisma.agents.findMany({
              where: { id: { in: input.agentIds } },
              select: { id: true, title: true, systemPrompt: true },
            })
          : Promise.resolve([]),
        input.mcpIds.length > 0
          ? this.prisma.mcp_servers.findMany({
              where: { id: { in: input.mcpIds } },
              select: { id: true, serverName: true, transport: true },
            })
          : Promise.resolve([]),
        input.imageTemplateIds.length > 0
          ? this.prisma.image_templates.findMany({
              where: { id: { in: input.imageTemplateIds } },
              select: {
                id: true,
                title: true,
                prompt: true,
                variables: true,
                modelHint: true,
              },
            })
          : Promise.resolve([]),
        input.videoTemplateIds.length > 0
          ? this.prisma.video_templates.findMany({
              where: { id: { in: input.videoTemplateIds } },
              select: {
                id: true,
                title: true,
                prompt: true,
                variables: true,
                modelHint: true,
              },
            })
          : Promise.resolve([]),
      ]);

    return { skills, agents, mcps, imageTemplates, videoTemplates };
  }

  findSkillMention(id: string) {
    return this.prisma.skills.findUnique({
      where: { id },
      select: { title: true, instructions: true },
    });
  }

  findAgentMention(id: string) {
    return this.prisma.agents.findUnique({
      where: { id },
      select: { title: true, systemPrompt: true },
    });
  }

  findMcpMention(id: string) {
    return this.prisma.mcp_servers.findUnique({
      where: { id },
      select: { title: true, serverName: true, transport: true },
    });
  }

  findResourceDetailsByType(resourceType: ResourceType, ids: string[]) {
    const where = { id: { in: ids } };

    switch (resourceType) {
      case ResourceType.SKILL:
        return this.prisma.skills.findMany({ where });
      case ResourceType.MCP:
        return this.prisma.mcp_servers.findMany({ where });
      case ResourceType.AGENT:
        return this.prisma.agents.findMany({ where });
      case ResourceType.IMAGE_TEMPLATE:
        return this.prisma.image_templates.findMany({ where });
      case ResourceType.VIDEO_TEMPLATE:
        return this.prisma.video_templates.findMany({ where });
      default:
        return Promise.resolve([]);
    }
  }

  findAssistantImageMessages(conversationId: string, take: number) {
    return this.prisma.messages.findMany({
      where: {
        conversationId,
        role: MessageRole.ASSISTANT,
      },
      select: { id: true, createdAt: true, metadata: true },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  findStepArtifactsByRun(runId: string) {
    return this.prisma.workflow_step_artifacts.findMany({
      where: { runId },
      orderBy: [{ stepKey: 'asc' }, { version: 'desc' }],
    });
  }
}
