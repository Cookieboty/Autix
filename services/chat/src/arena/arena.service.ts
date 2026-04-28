import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { createChatModelFromDbConfig } from '../llm/model.factory';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface ArenaStreamEvent {
  modelId: string;
  type: 'markdown' | 'done' | 'error';
  content?: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error?: string;
}

@Injectable()
export class ArenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modelConfigService: ModelConfigService,
  ) {}

  async createSession(userId: string, title?: string) {
    return this.prisma.arena_sessions.create({
      data: { userId, title: title || '新对比' },
    });
  }

  async findSessions(userId: string) {
    return this.prisma.arena_sessions.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findSessionById(id: string, userId: string) {
    const session = await this.prisma.arena_sessions.findUnique({
      where: { id },
      include: {
        turns: {
          orderBy: { createdAt: 'asc' },
          include: {
            responses: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId)
      throw new ForbiddenException('无权访问此 session');
    return session;
  }

  async deleteSession(id: string, userId: string) {
    const session = await this.prisma.arena_sessions.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId)
      throw new ForbiddenException('无权删除此 session');
    return this.prisma.arena_sessions.delete({ where: { id } });
  }

  async clearTurns(id: string, userId: string) {
    const session = await this.prisma.arena_sessions.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId)
      throw new ForbiddenException('无权操作此 session');
    await this.prisma.arena_turns.deleteMany({ where: { sessionId: id } });
    return { cleared: true };
  }

  async createTurnWithResponses(
    sessionId: string,
    userMessage: string,
    modelIds: string[],
  ) {
    const turn = await this.prisma.arena_turns.create({
      data: {
        sessionId,
        userMessage,
        responses: {
          create: modelIds.map((modelConfigId) => ({
            modelConfigId,
            status: 'pending',
          })),
        },
      },
      include: { responses: true },
    });

    await this.prisma.arena_sessions.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return turn;
  }

  async getHistoryMessages(sessionId: string) {
    const turns = await this.prisma.arena_turns.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      include: {
        responses: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const messages: (HumanMessage | AIMessage)[] = [];
    for (const turn of turns) {
      messages.push(new HumanMessage(turn.userMessage));
      if (turn.responses.length > 0 && turn.responses[0].content) {
        messages.push(new AIMessage(turn.responses[0].content));
      }
    }
    return messages;
  }

  async buildModelInstance(modelConfigId: string): Promise<BaseChatModel> {
    const config =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    return createChatModelFromDbConfig(config);
  }

  async *streamModelChat(
    model: BaseChatModel,
    modelConfigId: string,
    messages: (HumanMessage | AIMessage)[],
  ): AsyncGenerator<ArenaStreamEvent> {
    const startTime = Date.now();
    let fullContent = '';
    let usage: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    } | null = null;

    try {
      const stream = await model.stream(messages);

      for await (const chunk of stream) {
        const text =
          typeof chunk.content === 'string'
            ? chunk.content
            : Array.isArray(chunk.content)
              ? chunk.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('')
              : '';

        if (text) {
          fullContent += text;
          yield {
            modelId: modelConfigId,
            type: 'markdown',
            content: text,
          };
        }

        if ((chunk as any).usage_metadata) {
          usage = (chunk as any).usage_metadata;
        }
      }

      const durationMs = Date.now() - startTime;

      yield {
        modelId: modelConfigId,
        type: 'done',
        content: fullContent,
        durationMs,
        promptTokens: usage?.input_tokens ?? null,
        completionTokens: usage?.output_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
      } as ArenaStreamEvent;
    } catch (err) {
      yield {
        modelId: modelConfigId,
        type: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  async updateResponse(
    responseId: string,
    data: {
      content?: string;
      status?: string;
      durationMs?: number;
      promptTokens?: number | null;
      completionTokens?: number | null;
      totalTokens?: number | null;
      error?: string;
    },
  ) {
    return this.prisma.arena_responses.update({
      where: { id: responseId },
      data,
    });
  }
}
