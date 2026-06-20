import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentKind, ResourceType } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const ACTIVATABLE_TYPES = new Set<ResourceType>([
  ResourceType.SKILL,
  ResourceType.MCP,
  ResourceType.AGENT,
  ResourceType.IMAGE_TEMPLATE,
  ResourceType.VIDEO_TEMPLATE,
]);

const ACQUISITION_REQUIRED_TYPES = new Set<ResourceType>([
  ResourceType.SKILL,
  ResourceType.MCP,
  ResourceType.AGENT,
]);

@Injectable()
export class ConversationResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async attach(
    userId: string,
    conversationId: string,
    type: ResourceType,
    resourceId: string,
  ) {
    if (!ACTIVATABLE_TYPES.has(type)) {
      throw new BadRequestException(
        `资源类型 ${type} 不支持会话激活`,
      );
    }
    await this.requireOwnConversation(conversationId, userId);

    if (ACQUISITION_REQUIRED_TYPES.has(type)) {
      let skipAcquisition = false;
      if (type === ResourceType.AGENT) {
        const agent = await this.prisma.agents.findUnique({
          where: { id: resourceId },
          select: { isSystem: true },
        });
        if (agent?.isSystem) skipAcquisition = true;
      }
      if (!skipAcquisition) {
        const owns = await this.prisma.user_resource_acquisitions.findUnique({
          where: {
            userId_resourceType_resourceId: {
              userId,
              resourceType: type,
              resourceId,
            },
          },
        });
        if (!owns) throw new ForbiddenException('需先获取该资源才能激活到会话');
      }
    }

    const existing = await this.prisma.conversation_resources.findUnique({
      where: {
        conversationId_resourceType_resourceId: {
          conversationId,
          resourceType: type,
          resourceId,
        },
      },
    });
    if (existing) throw new ConflictException('已激活');

    if (type === ResourceType.IMAGE_TEMPLATE || type === ResourceType.VIDEO_TEMPLATE) {
      const existingTemplate =
        await this.prisma.conversation_resources.findFirst({
          where: { conversationId, resourceType: type },
        });
      if (existingTemplate) {
        throw new ConflictException(
          type === ResourceType.IMAGE_TEMPLATE
            ? '会话已关联图片模板，请先移除后再关联'
            : '会话已关联视频模板，请先移除后再关联',
        );
      }
    }

    if (type === ResourceType.AGENT) {
      const existingAgentRes =
        await this.prisma.conversation_resources.findFirst({
          where: {
            conversationId,
            resourceType: ResourceType.AGENT,
          },
          select: { resourceId: true },
        });

      if (existingAgentRes) {
        const messageCount = await this.prisma.messages.count({
          where: { conversationId },
        });
        if (messageCount > 0) {
          const [currentAgent, newAgent] = await Promise.all([
            this.prisma.agents.findUnique({
              where: { id: existingAgentRes.resourceId },
              select: { kind: true },
            }),
            this.prisma.agents.findUnique({
              where: { id: resourceId },
              select: { kind: true },
            }),
          ]);
          if (currentAgent && newAgent && currentAgent.kind !== newAgent.kind) {
            throw new BadRequestException(
              '对话已开始，无法切换到不同模式的 Agent。请新建会话切换。',
            );
          }
        }
        throw new ConflictException('会话已关联 Agent，请先移除后再关联');
      }
    }

    const created = await this.prisma.conversation_resources.create({
      data: {
        conversationId,
        resourceType: type,
        resourceId,
        activatedBy: userId,
      },
    });

    if (type === ResourceType.IMAGE_TEMPLATE) {
      await this.setConversationKind(conversationId, AgentKind.image);
      await this.autoSwitchToImageAgent(conversationId, userId);
    }
    if (type === ResourceType.VIDEO_TEMPLATE) {
      await this.setConversationKind(conversationId, AgentKind.video);
    }

    return created;
  }

  private async autoSwitchToImageAgent(
    conversationId: string,
    userId: string,
  ) {
    const existingAgentRes =
      await this.prisma.conversation_resources.findFirst({
        where: { conversationId, resourceType: ResourceType.AGENT },
        select: { resourceId: true },
      });

    if (existingAgentRes) {
      const agent = await this.prisma.agents.findUnique({
        where: { id: existingAgentRes.resourceId },
        select: { kind: true },
      });
      if (agent?.kind === 'image') return;

      await this.prisma.conversation_resources.delete({
        where: {
          conversationId_resourceType_resourceId: {
            conversationId,
            resourceType: ResourceType.AGENT,
            resourceId: existingAgentRes.resourceId,
          },
        },
      });
    }

    const imageAgent = await this.prisma.agents.findFirst({
      where: { isSystem: true, kind: 'image', executionMode: 'single' },
      select: { id: true },
    });
    if (imageAgent) {
      await this.prisma.conversation_resources.create({
        data: {
          conversationId,
          resourceType: ResourceType.AGENT,
          resourceId: imageAgent.id,
          activatedBy: userId,
        },
      });
    }
  }

  async detach(
    userId: string,
    conversationId: string,
    type: ResourceType,
    resourceId: string,
  ) {
    await this.requireOwnConversation(conversationId, userId);
    const result = await this.prisma.conversation_resources.delete({
      where: {
        conversationId_resourceType_resourceId: {
          conversationId,
          resourceType: type,
          resourceId,
        },
      },
    });

    if (type === ResourceType.IMAGE_TEMPLATE) {
      await this.autoRestoreChatAgent(conversationId, userId);
      await this.restoreConversationKindFromTemplates(conversationId);
    }
    if (type === ResourceType.VIDEO_TEMPLATE) {
      await this.restoreConversationKindFromTemplates(conversationId);
    }

    return result;
  }

  private async autoRestoreChatAgent(
    conversationId: string,
    userId: string,
  ) {
    const remaining = await this.prisma.conversation_resources.findFirst({
      where: {
        conversationId,
        resourceType: ResourceType.IMAGE_TEMPLATE,
      },
    });
    if (remaining) return;

    const agentRes = await this.prisma.conversation_resources.findFirst({
      where: { conversationId, resourceType: ResourceType.AGENT },
      select: { resourceId: true },
    });
    if (!agentRes) return;

    const agent = await this.prisma.agents.findUnique({
      where: { id: agentRes.resourceId },
      select: { kind: true, isSystem: true },
    });
    if (!agent || agent.kind !== 'image') return;

    await this.prisma.conversation_resources.delete({
      where: {
        conversationId_resourceType_resourceId: {
          conversationId,
          resourceType: ResourceType.AGENT,
          resourceId: agentRes.resourceId,
        },
      },
    });

    const chatAgent = await this.prisma.agents.findFirst({
      where: { isSystem: true, kind: 'chat', executionMode: 'single' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (chatAgent) {
      await this.prisma.conversation_resources.create({
        data: {
          conversationId,
          resourceType: ResourceType.AGENT,
          resourceId: chatAgent.id,
          activatedBy: userId,
        },
      });
    }
  }

  private async restoreConversationKindFromTemplates(conversationId: string) {
    const videoTemplate = await this.prisma.conversation_resources.findFirst({
      where: {
        conversationId,
        resourceType: ResourceType.VIDEO_TEMPLATE,
      },
    });
    if (videoTemplate) {
      await this.setConversationKind(conversationId, AgentKind.video);
      return;
    }

    const imageTemplate = await this.prisma.conversation_resources.findFirst({
      where: {
        conversationId,
        resourceType: ResourceType.IMAGE_TEMPLATE,
      },
    });
    await this.setConversationKind(
      conversationId,
      imageTemplate ? AgentKind.image : AgentKind.chat,
    );
  }

  private async setConversationKind(
    conversationId: string,
    kind: AgentKind,
  ) {
    await this.prisma.conversations.update({
      where: { id: conversationId },
      data: { kind },
    });
  }

  async list(userId: string, conversationId: string) {
    await this.requireOwnConversation(conversationId, userId);
    const links = await this.prisma.conversation_resources.findMany({
      where: { conversationId },
      orderBy: { activatedAt: 'asc' },
    });
    return this.enrich(links);
  }

  /**
   * 构造会话级资源 system prompt 片段(包含已激活 Skills + Agents)。
   * MCP 不进 prompt,而是挂到工具调用上下文。
   * 同时返回 mcpRefs 供调用方用于工具列表挂载。
   */
  async buildResourcePrompt(conversationId: string): Promise<{
    prompt: string;
    mcpRefs: { id: string; serverName: string; transport: string }[];
  }> {
    const links = await this.prisma.conversation_resources.findMany({
      where: { conversationId },
      orderBy: { activatedAt: 'asc' },
    });

    if (links.length === 0) return { prompt: '', mcpRefs: [] };

    const skillIds = links
      .filter((l) => l.resourceType === ResourceType.SKILL)
      .map((l) => l.resourceId);
    const agentIds = links
      .filter((l) => l.resourceType === ResourceType.AGENT)
      .map((l) => l.resourceId);
    const mcpIds = links
      .filter((l) => l.resourceType === ResourceType.MCP)
      .map((l) => l.resourceId);
    const imageTemplateIds = links
      .filter((l) => l.resourceType === ResourceType.IMAGE_TEMPLATE)
      .map((l) => l.resourceId);
    const videoTemplateIds = links
      .filter((l) => l.resourceType === ResourceType.VIDEO_TEMPLATE)
      .map((l) => l.resourceId);

    const [skills, agents, mcps, imageTemplates, videoTemplates] = await Promise.all([
      skillIds.length > 0
        ? this.prisma.skills.findMany({
            where: { id: { in: skillIds } },
            select: { id: true, title: true, instructions: true },
          })
        : Promise.resolve([]),
      agentIds.length > 0
        ? this.prisma.agents.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, title: true, systemPrompt: true },
          })
        : Promise.resolve([]),
      mcpIds.length > 0
        ? this.prisma.mcp_servers.findMany({
            where: { id: { in: mcpIds } },
            select: { id: true, serverName: true, transport: true },
          })
        : Promise.resolve([]),
      imageTemplateIds.length > 0
        ? this.prisma.image_templates.findMany({
            where: { id: { in: imageTemplateIds } },
            select: {
              id: true,
              title: true,
              prompt: true,
              variables: true,
              modelHint: true,
            },
          })
        : Promise.resolve([]),
      videoTemplateIds.length > 0
        ? this.prisma.video_templates.findMany({
            where: { id: { in: videoTemplateIds } },
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

    const sections: string[] = [];
    for (const s of skills) {
      sections.push(`## Skill: ${s.title}\n${s.instructions}`);
    }
    for (const a of agents) {
      sections.push(`## Agent: ${a.title}\n${a.systemPrompt}`);
    }
    for (const tpl of imageTemplates) {
      sections.push(
        [
          `## Image Template: ${tpl.title}`,
          `Prompt Template:\n${tpl.prompt}`,
          `Variables:\n${JSON.stringify(tpl.variables ?? [], null, 2)}`,
          tpl.modelHint ? `Preferred Image Model: ${tpl.modelHint}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    for (const tpl of videoTemplates) {
      sections.push(
        [
          `## Video Template: ${tpl.title}`,
          `Prompt Template:\n${tpl.prompt}`,
          `Variables:\n${JSON.stringify(tpl.variables ?? [], null, 2)}`,
          tpl.modelHint ? `Preferred Video Model: ${tpl.modelHint}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    const prompt =
      sections.length > 0
        ? `### 会话已激活资源(请遵循以下指令)\n\n${sections.join('\n\n')}`
        : '';

    return { prompt, mcpRefs: mcps };
  }

  /**
   * 解析消息中的 @resourceType:id 标记,返回拼接的临时 prompt(本条消息生效)
   * 标记示例: @skill:abc123 / @agent:xyz789 / @mcp:foo
   */
  async resolveMentions(userId: string, message: string): Promise<string> {
    const re = /@(skill|agent|mcp):([a-z0-9_-]+)/gi;
    const matches = [...message.matchAll(re)];
    if (matches.length === 0) return '';

    const sections: string[] = [];

    for (const m of matches) {
      const typeLower = m[1].toLowerCase();
      const id = m[2];
      const type =
        typeLower === 'skill'
          ? ResourceType.SKILL
          : typeLower === 'agent'
            ? ResourceType.AGENT
            : ResourceType.MCP;

      // 仅允许引用用户已获取的资源
      const acquired = await this.prisma.user_resource_acquisitions.findUnique({
        where: {
          userId_resourceType_resourceId: {
            userId,
            resourceType: type,
            resourceId: id,
          },
        },
      });
      if (!acquired) continue;

      if (type === ResourceType.SKILL) {
        const s = await this.prisma.skills.findUnique({
          where: { id },
          select: { title: true, instructions: true },
        });
        if (s) sections.push(`## @Skill: ${s.title}\n${s.instructions}`);
      } else if (type === ResourceType.AGENT) {
        const a = await this.prisma.agents.findUnique({
          where: { id },
          select: { title: true, systemPrompt: true },
        });
        if (a) sections.push(`## @Agent: ${a.title}\n${a.systemPrompt}`);
      } else {
        const m = await this.prisma.mcp_servers.findUnique({
          where: { id },
          select: { title: true, serverName: true, transport: true },
        });
        if (m)
          sections.push(
            `## @MCP: ${m.title} (${m.serverName}, ${m.transport})`,
          );
      }
    }

    return sections.length > 0
      ? `### 本条消息引用的资源(仅本次生效)\n\n${sections.join('\n\n')}`
      : '';
  }

  private async requireOwnConversation(
    conversationId: string,
    userId: string,
  ) {
    const conv = await this.prisma.conversations.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!conv) throw new NotFoundException('会话不存在');
    if (conv.userId !== userId) throw new ForbiddenException('无权访问该会话');
  }

  private async enrich(
    links: Array<{
      id: string;
      conversationId: string;
      resourceType: ResourceType;
      resourceId: string;
      activatedAt: Date;
      activatedBy: string;
    }>,
  ) {
    const grouped = links.reduce<Record<ResourceType, string[]>>(
      (acc, l) => {
        const arr = acc[l.resourceType] ?? [];
        arr.push(l.resourceId);
        acc[l.resourceType] = arr;
        return acc;
      },
      {} as Record<ResourceType, string[]>,
    );

    const detailMap = new Map<string, unknown>();
    for (const [t, ids] of Object.entries(grouped)) {
      if (ids.length === 0) continue;
      const where = { id: { in: ids } };
      let items: { id: string }[] = [];
      switch (t as ResourceType) {
        case ResourceType.SKILL:
          items = await this.prisma.skills.findMany({ where });
          break;
        case ResourceType.MCP:
          items = await this.prisma.mcp_servers.findMany({ where });
          break;
        case ResourceType.AGENT:
          items = await this.prisma.agents.findMany({ where });
          break;
        case ResourceType.IMAGE_TEMPLATE:
          items = await this.prisma.image_templates.findMany({ where });
          break;
        case ResourceType.VIDEO_TEMPLATE:
          items = await this.prisma.video_templates.findMany({ where });
          break;
        default:
          items = [];
      }
      for (const it of items) detailMap.set(`${t}:${it.id}`, it);
    }

    return links.map((l) => ({
      ...l,
      resource: detailMap.get(`${l.resourceType}:${l.resourceId}`),
    }));
  }
}
