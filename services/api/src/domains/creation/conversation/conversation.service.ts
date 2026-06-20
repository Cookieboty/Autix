import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ResourceType, AgentKind } from '../../platform/prisma/generated';
import { ConversationRepository } from './conversation.repository';

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
  constructor(private readonly repository: ConversationRepository) {}

  async create(userId: string, input: CreateConversationInput = {}) {
    const kind = input.kind ?? AgentKind.chat;
    let agentId = input.agentId ?? null;

    if (agentId) {
      const agent = await this.repository.findAgentForConversation(agentId);
      if (!agent) throw new BadRequestException('Agent 不存在');
      if (agent.kind !== kind) {
        throw new BadRequestException(
          `Agent kind=${agent.kind} 与 conversation kind=${kind} 不匹配`,
        );
      }
    }

    const conv = await this.repository.createConversation({
      userId,
      title: input.title ?? 'New Conversation',
      kind,
      agentId,
    });

    // 仅 chat 类型默认挂载 system chat agent；video/image/avatar 不挂
    if (kind === AgentKind.chat && !agentId) {
      try {
        const defaultAgent = await this.repository.findOldestSystemSingleAgent(
          AgentKind.chat,
        );
        if (defaultAgent) {
          await this.repository.createConversationResource({
            conversationId: conv.id,
            resourceType: ResourceType.AGENT,
            resourceId: defaultAgent.id,
            activatedBy: userId,
          });
        }
      } catch {
        // migration 未 apply 或 seed 未跑时，auto-attach 静默跳过
      }
    }

    return conv;
  }

  async findByUser(userId: string, options: ListConversationOptions = {}) {
    const items = await this.repository.findConversationsByUser(
      userId,
      options.kind,
    );

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
    const conv = await this.repository.findConversationById(conversationId);
    if (!conv) throw new NotFoundException('会话不存在');
    if (conv.userId !== userId) throw new ForbiddenException('无权访问该会话');
    return conv;
  }

  /**
   * 详情接口扩展返回 agent + videoProject，供 /c/[id] 路由判断渲染哪种工作台
   */
  async getDetail(conversationId: string, userId: string) {
    const conv = await this.repository.findConversationDetail(conversationId);
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

    await this.repository.updateConversationKind(conversationId, kind);

    if (kind === AgentKind.video) {
      const existing =
        await this.repository.findVideoProjectByConversationId(conversationId);
      if (!existing) {
        await this.repository.createVideoProjectForConversation({
          userId,
          title: conv.title ?? '新视频项目',
          conversationId,
        });
      }
    }

    return this.getDetail(conversationId, userId);
  }

  async delete(conversationId: string, userId: string) {
    await this.findById(conversationId, userId);
    await this.repository.deleteConversation(conversationId);
  }
}
