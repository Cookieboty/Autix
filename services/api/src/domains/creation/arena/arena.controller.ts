import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { ArenaService, type ArenaStreamEvent } from './arena.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { ChatFeatureGuard } from '../../platform/common/chat-feature.guard';
import type { HumanMessage } from '@langchain/core/messages';
import type { AuthUser } from '@autix/types';

type ArenaModelParams = Record<string, Record<string, unknown>>;
type ArenaSseMessage = {
  modelId?: string;
  messageType: ArenaStreamEvent['type'] | 'turn_created' | 'all_done';
  timestamp: string;
  payload: Record<string, unknown> | null;
};

function readNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

@UseGuards(JwtAuthGuard, ChatFeatureGuard)
@Controller('arena')
export class ArenaController {
  private readonly logger = new Logger(ArenaController.name);

  constructor(
    private readonly arenaService: ArenaService,
    private readonly modelConfigService: ModelConfigService,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: { title?: string }) {
    const userId = getCurrentUserId(user);
    return this.arenaService.createSession(userId, body.title);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.arenaService.findSessions(userId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.arenaService.findSessionById(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.arenaService.deleteSession(id, userId);
  }

  @Patch(':id/models')
  async updateModels(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { modelIds: string[] },
  ) {
    const userId = getCurrentUserId(user);
    return this.arenaService.updateSelectedModels(id, userId, body.modelIds ?? []);
  }

  @Delete(':id/turns')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearTurns(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.arenaService.clearTurns(id, userId);
  }

  @Post(':id/chat')
  async chat(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param('id') id: string,
    @Body()
    body: {
      message: string;
      modelIds: string[];
      images?: string[];
      modelParams?: ArenaModelParams;
    },
  ) {
    const userId = getCurrentUserId(user);

    await this.arenaService.findSessionById(id, userId);

    if (
      !body.modelIds ||
      !Array.isArray(body.modelIds) ||
      body.modelIds.length < 1 ||
      body.modelIds.length > 4
    ) {
      res.status(400).json({ error: '请选择 1-4 个模型' });
      return;
    }

    const models = await Promise.all(
      body.modelIds.map(async (modelId) => {
        const config = await this.modelConfigService.findById(modelId);
        return config;
      }),
    );

    const turn = await this.arenaService.createTurnWithResponses(
      id,
      body.message,
      body.modelIds,
      body.images,
    );

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const formatSSE = (data: ArenaSseMessage): string =>
      `data: ${JSON.stringify(data)}\n\n`;

    res.write(
      formatSSE({
        messageType: 'turn_created',
        timestamp: new Date().toISOString(),
        payload: {
          turnId: turn.id,
          responses: turn.responses.map((r) => ({
            id: r.id,
            modelConfigId: r.modelConfigId,
          })),
        },
      }),
    );

    const historyMessages = await this.arenaService.getHistoryMessages(id);
    const currentMessage = this.arenaService.buildMultimodalMessage(
      body.message,
      body.images,
    );
    const allMessages = [...historyMessages, currentMessage];

    const responseMap = new Map(
      turn.responses.map((r) => [r.modelConfigId, r]),
    );

    const modelStreams = body.modelIds.map(async (modelId) => {
      const responseRecord = responseMap.get(modelId)!;
      const perModelParams = body.modelParams?.[modelId];
      const modelConfig = models.find((m) => m.id === modelId);
      const isImageGen =
        modelConfig?.capabilities?.includes('image') &&
        !modelConfig?.capabilities?.includes('vision') &&
        !modelConfig?.capabilities?.includes('text');

      try {
        await this.arenaService.updateResponse(responseRecord.id, {
          status: 'streaming',
        });

        if (isImageGen) {
          const { temperature, topP, maxTokens, frequencyPenalty, presencePenalty, ...imageParams } =
            perModelParams ?? {};
          const events = await this.arenaService.callImageGeneration(
            modelId,
            body.message,
            Object.keys(imageParams).length > 0 ? imageParams : undefined,
          );
          const collectedImages: string[] = [];
          for (const event of events) {
            const sseMessage = {
              modelId: event.modelId,
              messageType: event.type,
              timestamp: new Date().toISOString(),
              payload: {},
            } satisfies ArenaSseMessage;
            switch (event.type) {
              case 'image':
                sseMessage.payload = { imageUrl: event.imageUrl };
                if (event.imageUrl) collectedImages.push(event.imageUrl);
                break;
              case 'done':
                sseMessage.payload = { durationMs: event.durationMs };
                await this.arenaService.updateResponse(responseRecord.id, {
                  content: '',
                  images: collectedImages,
                  status: 'completed',
                  durationMs: event.durationMs,
                });
                break;
              case 'error':
                sseMessage.payload = { error: event.error };
                await this.arenaService.updateResponse(responseRecord.id, {
                  status: 'error',
                  error: event.error,
                  durationMs: event.durationMs,
                });
                break;
            }
            res.write(formatSSE(sseMessage));
          }
          return;
        }

        const chatOverrides = perModelParams
          ? {
              temperature: readNumber(perModelParams.temperature),
              topP: readNumber(perModelParams.topP),
              maxTokens: readNumber(perModelParams.maxTokens),
              frequencyPenalty: readNumber(perModelParams.frequencyPenalty),
              presencePenalty: readNumber(perModelParams.presencePenalty),
            }
          : undefined;

        const modelInstance = await this.arenaService.buildModelInstance(
          modelId,
          chatOverrides,
        );

        const stream = this.arenaService.streamModelChat(
          modelInstance,
          modelId,
          allMessages,
        );

        const chatImages: string[] = [];
        for await (const event of stream) {
          const sseMessage = {
            modelId: event.modelId,
            messageType: event.type,
            timestamp: new Date().toISOString(),
            payload: {},
          } satisfies ArenaSseMessage;

          switch (event.type) {
            case 'markdown':
              sseMessage.payload = { content: event.content };
              break;
            case 'image':
              sseMessage.payload = { imageUrl: event.imageUrl };
              if (event.imageUrl) chatImages.push(event.imageUrl);
              break;
            case 'done':
              sseMessage.payload = {
                durationMs: event.durationMs,
                promptTokens: event.promptTokens,
                completionTokens: event.completionTokens,
                totalTokens: event.totalTokens,
              };
              await this.arenaService.updateResponse(responseRecord.id, {
                content: event.content,
                ...(chatImages.length > 0 ? { images: chatImages } : {}),
                status: 'completed',
                durationMs: event.durationMs,
                promptTokens: event.promptTokens,
                completionTokens: event.completionTokens,
                totalTokens: event.totalTokens,
              });
              break;
            case 'error':
              sseMessage.payload = { error: event.error };
              await this.arenaService.updateResponse(responseRecord.id, {
                status: 'error',
                error: event.error,
                durationMs: event.durationMs,
              });
              break;
          }

          res.write(formatSSE(sseMessage));
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error';
        res.write(
          formatSSE({
            modelId,
            messageType: 'error',
            timestamp: new Date().toISOString(),
            payload: { error: errorMsg },
          }),
        );
        await this.arenaService.updateResponse(responseRecord.id, {
          status: 'error',
          error: errorMsg,
        });
      }
    });

    try {
      await Promise.all(modelStreams);
    } catch (err) {
      this.logger.error(
        'Unexpected error in parallel streams',
        err instanceof Error ? err.stack : String(err),
      );
    }

    res.write(
      formatSSE({
        messageType: 'all_done',
        timestamp: new Date().toISOString(),
        payload: null,
      }),
    );

    res.end();
  }
}
