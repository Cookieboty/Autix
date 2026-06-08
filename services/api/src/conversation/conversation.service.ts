import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceType, AgentKind } from '../prisma/generated';

export interface CreateConversationInput {
  title?: string;
  kind?: AgentKind;
  agentId?: string | null;
}

export interface ListConversationOptions {
  kind?: AgentKind;
}

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateConversationInput = {}) {
    const kind = input.kind ?? AgentKind.chat;
    let agentId = input.agentId ?? null;

    if (agentId) {
      const agent = await this.prisma.agents.findUnique({
        where: { id: agentId },
        select: { id: true, kind: true },
      });
      if (!agent) throw new BadRequestException('Agent 不存在');
      if (agent.kind !== kind) {
        throw new BadRequestException(
          `Agent kind=${agent.kind} 与 conversation kind=${kind} 不匹配`,
        );
      }
    }

    const conv = await this.prisma.conversations.create({
      data: {
        userId,
        title: input.title ?? 'New Conversation',
        kind,
        agentId,
      },
    });

    // 仅 chat 类型默认挂载 system chat agent；video/image/avatar 不挂
    if (kind === AgentKind.chat && !agentId) {
      try {
        const defaultAgent = await this.prisma.agents.findFirst({
          where: { isSystem: true, kind: 'chat', executionMode: 'single' },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (defaultAgent) {
          await this.prisma.conversation_resources.create({
            data: {
              conversationId: conv.id,
              resourceType: ResourceType.AGENT,
              resourceId: defaultAgent.id,
              activatedBy: userId,
            },
          });
        }
      } catch {
        // migration 未 apply 或 seed 未跑时，auto-attach 静默跳过
      }
    }

    return conv;
  }

  async findByUser(userId: string, options: ListConversationOptions = {}) {
    const where: { userId: string; kind?: AgentKind } = { userId };
    if (options.kind) where.kind = options.kind;

    const items = await this.prisma.conversations.findMany({
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

    return items.map((c) => ({
      id: c.id,
      userId: c.userId,
      title: c.title,
      kind: c.kind,
      agentId: c.agentId,
      agent: c.agent
        ? { id: c.agent.id, name: c.agent.title, kind: c.agent.kind }
        : null,
      projectMeta: c.videoProject
        ? {
            projectId: c.videoProject.id,
            status: c.videoProject.status,
            clipCount: c.videoProject._count.clips,
          }
        : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async findById(conversationId: string, userId: string) {
    const conv = await this.prisma.conversations.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('会话不存在');
    if (conv.userId !== userId) throw new ForbiddenException('无权访问该会话');
    return conv;
  }

  /**
   * Plan-8: 详情接口扩展返回 agent + videoProject，供 /c/[id] 路由判断渲染哪种工作台
   */
  async getDetail(conversationId: string, userId: string) {
    const conv = await this.prisma.conversations.findUnique({
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
    if (!conv) throw new NotFoundException('会话不存在');
    if (conv.userId !== userId) throw new ForbiddenException('无权访问该会话');

    return {
      id: conv.id,
      userId: conv.userId,
      title: conv.title,
      kind: conv.kind,
      agentId: conv.agentId,
      agent: conv.agent
        ? { id: conv.agent.id, name: conv.agent.title, kind: conv.agent.kind }
        : null,
      videoProject: conv.videoProject
        ? {
            id: conv.videoProject.id,
            title: conv.videoProject.title,
            status: conv.videoProject.status,
            coverImage: conv.videoProject.coverImage,
            clipCount: conv.videoProject._count.clips,
            createdAt: conv.videoProject.createdAt,
            updatedAt: conv.videoProject.updatedAt,
          }
        : null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  }

  async updateKind(conversationId: string, userId: string, kind: AgentKind) {
    const conv = await this.findById(conversationId, userId);
    if (conv.kind === kind) return this.getDetail(conversationId, userId);

    await this.prisma.conversations.update({
      where: { id: conversationId },
      data: { kind },
    });

    if (kind === AgentKind.video) {
      const existing = await this.prisma.video_projects.findUnique({
        where: { conversationId },
        select: { id: true },
      });
      if (!existing) {
        await this.prisma.video_projects.create({
          data: {
            userId,
            title: conv.title ?? '新视频项目',
            conversationId,
            status: 'draft',
          },
        });
      }
    }

    return this.getDetail(conversationId, userId);
  }

  async delete(conversationId: string, userId: string) {
    await this.findById(conversationId, userId);
    await this.prisma.conversations.delete({ where: { id: conversationId } });
  }
}
