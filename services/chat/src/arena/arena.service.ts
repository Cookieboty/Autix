import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModelConfigService } from '../model-config/model-config.service';
import {
  createChatModelFromDbConfig,
  createChatModelWithOverrides,
  type ArenaModelOverrides,
} from '../llm/model.factory';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface ArenaStreamEvent {
  modelId: string;
  type: 'markdown' | 'image' | 'done' | 'error';
  content?: string;
  imageUrl?: string;
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

  async createSession(userId: string, title?: string, selectedModelIds?: string[]) {
    return this.prisma.arena_sessions.create({
      data: { userId, title: title || '新对比', selectedModelIds: selectedModelIds ?? [] },
    });
  }

  async updateSelectedModels(id: string, userId: string, modelIds: string[]) {
    const session = await this.prisma.arena_sessions.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId) throw new ForbiddenException('无权操作此 session');
    return this.prisma.arena_sessions.update({
      where: { id },
      data: { selectedModelIds: modelIds },
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
    images?: string[],
  ) {
    const turn = await this.prisma.arena_turns.create({
      data: {
        sessionId,
        userMessage,
        images: images ?? [],
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

  async buildModelInstance(
    modelConfigId: string,
    overrides?: ArenaModelOverrides,
  ): Promise<BaseChatModel> {
    const config =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    if (overrides && Object.keys(overrides).length > 0) {
      return createChatModelWithOverrides(config, overrides);
    }
    return createChatModelFromDbConfig(config);
  }

  async callImageGeneration(
    modelConfigId: string,
    prompt: string,
    imageParams?: Record<string, any>,
  ): Promise<ArenaStreamEvent[]> {
    const config =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId);
    const metadata = config.metadata as Record<string, any> | null;
    const apiKey =
      config.apiKey ?? metadata?.apiKey ?? '';
    const baseUrl =
      config.baseUrl ?? metadata?.baseUrl ?? '';

    if (!baseUrl || !apiKey) {
      return [
        {
          modelId: modelConfigId,
          type: 'error',
          error: '图片模型缺少 baseUrl 或 apiKey 配置',
          durationMs: 0,
        },
      ];
    }

    const startTime = Date.now();
    const url = `${baseUrl.replace(/\/$/, '')}/images/generations`;

    const body: Record<string, any> = {
      model: config.model,
      prompt,
      response_format: 'b64_json',
      ...imageParams,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return [
          {
            modelId: modelConfigId,
            type: 'error',
            error: `Image API ${response.status}: ${text.slice(0, 200)}`,
            durationMs: Date.now() - startTime,
          },
        ];
      }

      const data = (await response.json()) as any;
      const events: ArenaStreamEvent[] = [];

      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          const imageUrl = item.b64_json
            ? `data:image/png;base64,${item.b64_json}`
            : item.url;
          if (imageUrl) {
            events.push({
              modelId: modelConfigId,
              type: 'image',
              imageUrl,
            });
          }
        }
      }

      events.push({
        modelId: modelConfigId,
        type: 'done',
        content: '',
        durationMs: Date.now() - startTime,
      });

      return events;
    } catch (err) {
      return [
        {
          modelId: modelConfigId,
          type: 'error',
          error: err instanceof Error ? err.message : 'Image generation failed',
          durationMs: Date.now() - startTime,
        },
      ];
    }
  }

  buildMultimodalMessage(
    userMessage: string,
    images?: string[],
  ): HumanMessage {
    if (!images || images.length === 0) {
      return new HumanMessage(userMessage);
    }
    return new HumanMessage({
      content: [
        { type: 'text', text: userMessage },
        ...images.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ],
    });
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
        if (Array.isArray(chunk.content)) {
          for (const part of chunk.content as any[]) {
            if (part.type === 'text' && part.text) {
              fullContent += part.text;
              yield {
                modelId: modelConfigId,
                type: 'markdown',
                content: part.text,
              };
            } else if (part.type === 'image_url' && part.image_url?.url) {
              yield {
                modelId: modelConfigId,
                type: 'image',
                imageUrl: part.image_url.url,
              };
            }
          }
        } else if (typeof chunk.content === 'string' && chunk.content) {
          fullContent += chunk.content;
          yield {
            modelId: modelConfigId,
            type: 'markdown',
            content: chunk.content,
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
      images?: string[];
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
