import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVATABLE_TYPES = new Set<ResourceType>([
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
        `资源类型 ${type} 不支持会话激活(仅 SKILL/MCP/AGENT)`,
      );
    }
    await this.requireOwnConversation(conversationId, userId);

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

    return this.prisma.conversation_resources.create({
      data: {
        conversationId,
        resourceType: type,
        resourceId,
        activatedBy: userId,
      },
    });
  }

  async detach(
    userId: string,
    conversationId: string,
    type: ResourceType,
    resourceId: string,
  ) {
    await this.requireOwnConversation(conversationId, userId);
    return this.prisma.conversation_resources.delete({
      where: {
        conversationId_resourceType_resourceId: {
          conversationId,
          resourceType: type,
          resourceId,
        },
      },
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

    const [skills, agents, mcps] = await Promise.all([
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
    ]);

    const sections: string[] = [];
    for (const s of skills) {
      sections.push(`## Skill: ${s.title}\n${s.instructions}`);
    }
    for (const a of agents) {
      sections.push(`## Agent: ${a.title}\n${a.systemPrompt}`);
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
