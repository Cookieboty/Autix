import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ModelConfigService } from '../model-config/model-config.service';
import {
  createChatModelFromDbConfig,
  createChatModelWithOverrides,
  type ArenaModelOverrides,
} from '../llm/model.factory';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { resolveImageAdapter, type ImageCallContext } from '@autix/ai-adapters/image';
import { ArenaRepository } from './arena.repository';

type ArenaImageParams = {
  n?: unknown;
  size?: unknown;
  quality?: unknown;
  [key: string]: unknown;
};

type StreamContentPart = {
  type?: unknown;
  text?: unknown;
  image_url?: {
    url?: unknown;
  };
};

type TokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

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
    private readonly arenaRepository: ArenaRepository,
    private readonly modelConfigService: ModelConfigService,
  ) {}

  async createSession(userId: string, title?: string, selectedModelIds?: string[]) {
    return this.arenaRepository.createSession(userId, title, selectedModelIds);
  }

  async updateSelectedModels(id: string, userId: string, modelIds: string[]) {
    const session = await this.arenaRepository.findSession(id);
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId) throw new ForbiddenException('无权操作此 session');
    await Promise.all(
      modelIds.map((modelId) =>
        this.modelConfigService.getConfigForOrchestrator(modelId, userId),
      ),
    );
    return this.arenaRepository.updateSelectedModels(id, modelIds);
  }

  async findSessions(userId: string) {
    return this.arenaRepository.findSessions(userId);
  }

  async findSessionById(id: string, userId: string) {
    const session = await this.arenaRepository.findSessionDetail(id);
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId)
      throw new ForbiddenException('无权访问此 session');
    return session;
  }

  async deleteSession(id: string, userId: string) {
    const session = await this.arenaRepository.findSession(id);
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId)
      throw new ForbiddenException('无权删除此 session');
    return this.arenaRepository.deleteSession(id);
  }

  async clearTurns(id: string, userId: string) {
    const session = await this.arenaRepository.findSession(id);
    if (!session) throw new NotFoundException('Arena session 不存在');
    if (session.userId !== userId)
      throw new ForbiddenException('无权操作此 session');
    await this.arenaRepository.clearTurns(id);
    return { cleared: true };
  }

  async createTurnWithResponses(
    sessionId: string,
    userMessage: string,
    modelIds: string[],
    images?: string[],
  ) {
    return this.arenaRepository.createTurnWithResponses(
      sessionId,
      userMessage,
      modelIds,
      images,
    );
  }

  async getHistoryMessages(sessionId: string) {
    const turns = await this.arenaRepository.findTurnsForHistory(sessionId);

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
    userId: string,
    overrides?: ArenaModelOverrides,
  ): Promise<BaseChatModel> {
    const config =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId, userId);
    if (overrides && Object.keys(overrides).length > 0) {
      return createChatModelWithOverrides(config, overrides);
    }
    return createChatModelFromDbConfig(config);
  }

  async callImageGeneration(
    modelConfigId: string,
    userId: string,
    prompt: string,
    imageParams?: ArenaImageParams,
  ): Promise<ArenaStreamEvent[]> {
    const config =
      await this.modelConfigService.getConfigForOrchestrator(modelConfigId, userId);
    const metadata = this.asRecord(config.metadata);
    const apiKey =
      config.apiKey ?? this.readString(metadata?.apiKey) ?? '';
    const baseUrl =
      config.baseUrl ?? this.readString(metadata?.baseUrl) ?? '';

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

    const ctx: ImageCallContext = {
      baseUrl,
      apiKey,
      model: config.model,
      prompt,
      count: this.readNumber(imageParams?.n) ?? 1,
      size: this.readString(imageParams?.size),
      quality: this.readString(imageParams?.quality),
      metadata,
    };

    try {
      const adapter = resolveImageAdapter(
        config.provider,
        metadata,
      );
      const images = await adapter.generate(ctx);

      const events: ArenaStreamEvent[] = images.map((imageUrl) => ({
        modelId: modelConfigId,
        type: 'image' as const,
        imageUrl,
      }));

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
          for (const part of chunk.content as StreamContentPart[]) {
            if (part.type === 'text' && typeof part.text === 'string' && part.text) {
              fullContent += part.text;
              yield {
                modelId: modelConfigId,
                type: 'markdown',
                content: part.text,
              };
            } else if (
              part.type === 'image_url' &&
              typeof part.image_url?.url === 'string' &&
              part.image_url.url
            ) {
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

        const chunkRecord = this.asRecord(chunk);
        const usageMetadata = this.asRecord(chunkRecord?.usage_metadata);
        if (usageMetadata) {
          usage = this.readTokenUsage(usageMetadata);
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
    return this.arenaRepository.updateResponse(responseId, data);
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private readTokenUsage(value: Record<string, unknown>): TokenUsage {
    return {
      input_tokens: this.readNumber(value.input_tokens),
      output_tokens: this.readNumber(value.output_tokens),
      total_tokens: this.readNumber(value.total_tokens),
    };
  }
}
