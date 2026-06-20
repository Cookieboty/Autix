import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { ConversationService } from './conversation.service';
import { ConversationMediaService } from './conversation-media.service';
import { ConversationResourcesService } from './conversation-resources.service';
import { MessageService } from '../message/message.service';
import { OrchestratorService } from '../llm/agents/orchestrator.service';
import { AgentWorkflowService } from '../llm/workflow/agent-workflow.service';
import { ImageGenerationFlowService } from '../llm/workflow/image-generation-flow.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { MessageRole, ResourceType, AgentKind } from '../../platform/prisma/generated';
import { ArtifactService } from '../artifact/artifact.service';
import { VideoChatService } from '../video/video-chat.service';
import { ChatFeatureGuard } from '../../platform/common/chat-feature.guard';
import type { AuthUser } from '@autix/domain';
import { formatSseData, workflowEventToStreamMessage } from './conversation-stream-events';
import {
  appendStreamTokenContent,
  buildAssistantMessageMetadata,
  buildDoneStreamMessage,
  buildDuplicateProcessingStreamError,
  buildErrorStreamMessage,
  buildImageGenerationTaskId,
  buildImagePersistInput,
  buildImageResolveInput,
  buildImageResultStreamMessage,
  buildImageStartStreamMessage,
  collectStreamPersistence,
  formatConversationMessage,
  isDuplicateProcessingRequest,
  normalizeChatMessage,
  normalizeChatRequest,
  parseAgentKind,
  parsePositiveInt,
  resolveImageGenerationCount,
  resolveMessageRole,
  type ChatRequestPayload,
  type ImageGenerationBody,
  type StreamPersistenceDraft,
} from './conversation.controller.helpers';

@UseGuards(JwtAuthGuard, ChatFeatureGuard)
@Controller('conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly orchestratorService: OrchestratorService,
    private readonly workflowService: AgentWorkflowService,
    private readonly modelConfigService: ModelConfigService,
    private readonly conversationMediaService: ConversationMediaService,
    private readonly artifactService: ArtifactService,
    private readonly resourcesService: ConversationResourcesService,
    private readonly imageGenerationFlowService: ImageGenerationFlowService,
    private readonly videoChatService: VideoChatService,
  ) { }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title?: string; kind?: AgentKind; agentId?: string | null },
  ) {
    const userId = getCurrentUserId(user);
    return this.conversationService.create(userId, {
      title: body.title,
      kind: body.kind,
      agentId: body.agentId,
    });
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query('kind') kind?: string) {
    const userId = getCurrentUserId(user);
    return this.conversationService.findByUser(userId, { kind: parseAgentKind(kind) });
  }

  @Get(':id')
  async getDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.conversationService.getDetail(id, userId);
  }

  @Patch(':id/kind')
  async updateKind(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { kind: AgentKind },
  ) {
    const userId = getCurrentUserId(user);
    const kind = parseAgentKind(body.kind);
    if (!kind) {
      return this.conversationService.getDetail(id, userId);
    }
    return this.conversationService.updateKind(id, userId, kind);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);
    const messages = await this.messageService.getHistory(id, parsePositiveInt(limit));

    return messages.map(formatConversationMessage);
  }

  @Get(':id/images')
  async getConversationImages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);
    return this.conversationMediaService.listImages(id, limit);
  }


  @Post(':id/messages')
  async appendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { role: 'USER' | 'ASSISTANT'; content: string; metadata?: Record<string, unknown> },
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);
    return this.messageService.addMessage(id, resolveMessageRole(body.role), body.content, body.metadata);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.conversationService.delete(id, userId);
  }

  // ── Agent Run API ───────────────────────────────────────────────────────

  @Get(':id/agent-run/active')
  async getActiveRun(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);
    const run = await this.workflowService.getActiveRun(id);
    return run ?? null;
  }

  @Post(':id/agent-run/continue')
  async continueRun(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: { action: 'continue' | 'stop' | 'retry' | 'cancel'; stepKey?: string },
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);

    if (body.action === 'stop') {
      const run = await this.workflowService.getActiveRun(id);
      if (run) await this.workflowService.updateRunStatus(run.id, 'paused_user_stop');
      res.json({ ok: true });
      return;
    }

    if (body.action === 'cancel') {
      const run = await this.workflowService.getActiveRun(id);
      if (run) await this.workflowService.cancelRun(run.id);
      res.json({ ok: true });
      return;
    }

    // continue or retry → trigger SSE stream
    this.streamWorkflowResponse(res, id, userId, body.action === 'retry' ? '重试当前阶段' : '继续');
  }

  @Post(':id/agent-run/cancel')
  async cancelRun(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);
    const run = await this.workflowService.getActiveRun(id);
    if (run) await this.workflowService.cancelRun(run.id);
    return { ok: true };
  }

  @Get(':id/step-artifacts')
  async listStepArtifacts(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);
    const run = await this.workflowService.getActiveRun(id);
    if (!run) return [];
    return this.conversationMediaService.listStepArtifacts(run.id);
  }

  // ── Chat (SSE) ──────────────────────────────────────────────────────────

  private processingRequests = new Map<string, { hash: string; timestamp: number }>();

  @Post(':id/chat')
  async chat(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: ChatRequestPayload,
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);

    const chatRequest = normalizeChatRequest(body);
    const existing = this.processingRequests.get(id);
    const now = Date.now();

    if (isDuplicateProcessingRequest(existing, chatRequest.requestHash, now)) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.flushHeaders();
      res.write(formatSseData(buildDuplicateProcessingStreamError()));
      res.end();
      return;
    }

    this.processingRequests.set(id, { hash: chatRequest.requestHash, timestamp: now });
    await this.messageService.addMessage(
      id,
      MessageRole.USER,
      chatRequest.message,
      chatRequest.userMetadata,
    );

    this.streamWorkflowResponse(
      res,
      id,
      userId,
      body.message,
      body.modelId,
      chatRequest.streamOptions,
    );
  }

  @Post(':id/generate-image')
  async generateImage(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param('id') id: string,
    @Body()
    body: ImageGenerationBody,
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const context = { userId, conversationId: id, body };
    const taskId = buildImageGenerationTaskId();
    const count = resolveImageGenerationCount(body.n);

    try {
      const request = await this.imageGenerationFlowService.resolveImageRequest(
        buildImageResolveInput(context),
      );

      res.write(formatSseData(buildImageStartStreamMessage(taskId, request, count)));

      const result = await this.imageGenerationFlowService.generateAndPersistImage(
        buildImagePersistInput(context),
        request,
        count,
      );

      res.write(formatSseData(buildImageResultStreamMessage(taskId, request, result)));
      res.write(formatSseData(buildDoneStreamMessage()));
    } catch (err) {
      res.write(formatSseData(buildErrorStreamMessage(err)));
    } finally {
      res.end();
    }
  }

  private async streamWorkflowResponse(
    res: Response,
    conversationId: string,
    userId: string,
    message: string,
    modelId?: string,
    options?: {
      images?: string[];
      sourceImages?: Array<{
        url: string;
        prompt?: string;
        generationId?: string;
        index?: number;
      }>;
    },
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      let modelConfigId = modelId;
      if (!modelConfigId) {
        try {
          const def = await this.modelConfigService.findDefaultByTypeForUser('general', userId);
          modelConfigId = def?.id;
        } catch { /* fallback */ }
      }

      const startedAt = Date.now();
      const conv = await this.conversationService.findById(conversationId, userId);

      if (conv.kind === AgentKind.video) {
        const projectId = await this.conversationMediaService.findVideoProjectId(conversationId, userId);

        if (projectId) {
          const videoStream = this.videoChatService.chat({
            userId,
            conversationId,
            message: normalizeChatMessage(message),
            projectId,
            modelConfigId,
          });

          let persistedContent = '';
          for await (const event of videoStream) {
            const streamMessage = workflowEventToStreamMessage(event);
            if (streamMessage) res.write(formatSseData(streamMessage));
            persistedContent = appendStreamTokenContent(persistedContent, event);
          }

          const durationMs = Date.now() - startedAt;
          if (persistedContent) {
            await this.messageService.addMessage(
              conversationId,
              MessageRole.ASSISTANT,
              persistedContent,
              buildAssistantMessageMetadata(undefined, durationMs),
            );
          }

          res.write(formatSseData(buildDoneStreamMessage(durationMs)));
          return;
        }
      }

      const stream = this.orchestratorService.streamOrchestrate(
        message, '', userId, conversationId, modelConfigId, options,
      );

      let persistence: StreamPersistenceDraft = { content: '' };

      for await (const event of stream) {
        const streamMessage = workflowEventToStreamMessage(event);
        if (streamMessage) res.write(formatSseData(streamMessage));
        persistence = collectStreamPersistence(persistence, event);
      }

      const durationMs = Date.now() - startedAt;

      if (persistence.content) {
        await this.messageService.addMessage(
          conversationId,
          MessageRole.ASSISTANT,
          persistence.content,
          buildAssistantMessageMetadata(persistence.metadata, durationMs),
        );
      }

      res.write(formatSseData(buildDoneStreamMessage(durationMs)));
    } catch (err) {
      this.logger.error('chat SSE error', err instanceof Error ? err.stack : String(err));
      res.write(formatSseData(buildErrorStreamMessage(err)));
    } finally {
      this.processingRequests.delete(conversationId);
      res.end();
    }
  }
}

@UseGuards(JwtAuthGuard, ChatFeatureGuard)
@Controller('conversations')
export class ConversationResourcesController {
  constructor(
    private readonly resourcesService: ConversationResourcesService,
  ) { }

  @Get(':id/resources')
  list(@CurrentUser() user: AuthUser, @Param('id') conversationId: string) {
    const userId = getCurrentUserId(user);
    return this.resourcesService.list(userId, conversationId);
  }

  @Post(':id/resources')
  attach(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Body() body: { resourceType: ResourceType; resourceId: string },
  ) {
    const userId = getCurrentUserId(user);
    return this.resourcesService.attach(userId, conversationId, body.resourceType, body.resourceId);
  }

  @Delete(':id/resources/:type/:resourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detach(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Param('type') typeStr: string,
    @Param('resourceId') resourceId: string,
  ) {
    const userId = getCurrentUserId(user);
    await this.resourcesService.detach(userId, conversationId, typeStr.toUpperCase() as ResourceType, resourceId);
  }
}
