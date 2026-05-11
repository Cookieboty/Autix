import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceType } from '../prisma/generated';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, title?: string) {
    const conv = await this.prisma.conversations.create({
      data: { userId, title: title ?? 'New Conversation' },
    });

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

    return conv;
  }

  async findByUser(userId: string) {
    return this.prisma.conversations.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(conversationId: string, userId: string) {
    const conv = await this.prisma.conversations.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('会话不存在');
    if (conv.userId !== userId) throw new ForbiddenException('无权访问该会话');
    return conv;
  }

  async delete(conversationId: string, userId: string) {
    await this.findById(conversationId, userId);
    await this.prisma.conversations.delete({ where: { id: conversationId } });
  }
}
