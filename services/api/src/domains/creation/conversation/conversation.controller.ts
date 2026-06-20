import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type {
  StreamMessage,
  MarkdownPayload,
  ProgressPayload,
  LogPayload,
  StepCompletedPayload,
  StepArtifactCreatedPayload,
  PointsConsumedPayload,
} from '@autix/domain/ai-ui';
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
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';
import { VideoChatService } from '../video/video-chat.service';
import { ChatFeatureGuard } from '../../platform/common/chat-feature.guard';
import type { AuthUser } from '@autix/types';

type ChatAttachmentKind = 'image' | 'video' | 'audio' | 'file';

interface ChatAttachmentBody {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ChatAttachmentKind;
}

function isChatAttachmentKind(value: unknown): value is ChatAttachmentKind {
  return value === 'image' || value === 'video' || value === 'audio' || value === 'file';
}

function isChatAttachmentBody(value: unknown): value is ChatAttachmentBody {
  if (value == null || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.url === 'string' &&
    typeof item.name === 'string' &&
    typeof item.mimeType === 'string' &&
    typeof item.size === 'number' &&
    Number.isFinite(item.size) &&
    isChatAttachmentKind(item.kind)
  );
}

function sanitizeChatAttachments(value: unknown): ChatAttachmentBody[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isChatAttachmentBody)
    .map((item) => ({
      url: item.url,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      kind: item.kind,
    }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

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
    const parsedKind =
      kind && (Object.values(AgentKind) as string[]).includes(kind)
        ? (kind as AgentKind)
        : undefined;
    return this.conversationService.findByUser(userId, { kind: parsedKind });
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
    if (!(Object.values(AgentKind) as string[]).includes(body.kind)) {
      return this.conversationService.getDetail(id, userId);
    }
    return this.conversationService.updateKind(id, userId, body.kind);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const safeLimit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : undefined;

    const messages = await this.messageService.getHistory(id, safeLimit);

    return messages.map((msg) => {
      const metadata = asRecord(msg.metadata);
      const messageType = metadata?.messageType || 'markdown';

      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messageType,
        createdAt: msg.createdAt,
        timestamp: msg.createdAt,
        durationMs:
          typeof metadata?.durationMs === 'number' ? metadata.durationMs : undefined,
        metadata: {
          ...(metadata ?? {}),
          uiStage: metadata?.uiStage,
          retrievedDocuments: metadata?.retrievedDocuments,
        },
      };
    });
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
    const role = body.role === 'ASSISTANT' ? MessageRole.ASSISTANT : MessageRole.USER;
    return this.messageService.addMessage(id, role, body.content, body.metadata);
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
    @Req() req: Request,
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
    this.streamWorkflowResponse(req, res, id, userId, body.action === 'retry' ? '重试当前阶段' : '继续');
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
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: {
      message: string;
      modelId?: string;
      images?: string[];
      sourceImages?: Array<{
        url: string;
        prompt?: string;
        generationId?: string;
        index?: number;
      }>;
      attachments?: ChatAttachmentBody[];
    },
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);

    const messageStr = typeof body.message === 'string' ? body.message : JSON.stringify(body.message);
    const attachments = sanitizeChatAttachments(body.attachments);
    const imageUrls = Array.isArray(body.images) ? body.images.filter((url) => typeof url === 'string') : [];
    const attachmentHash = attachments.map((attachment) => attachment.url).join('|').slice(0, 256);
    const msgHash = `${messageStr.length}:${messageStr.slice(0, 64)}:${imageUrls.length}:${imageUrls.join('|').slice(0, 256)}:${attachments.length}:${attachmentHash}`;
    const existing = this.processingRequests.get(id);
    const now = Date.now();

    if (existing && existing.hash === msgHash && (now - existing.timestamp) < 10000) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'error', message: '请求正在处理中' })}\n\n`);
      res.end();
      return;
    }

    this.processingRequests.set(id, { hash: msgHash, timestamp: now });
    await this.messageService.addMessage(
      id,
      MessageRole.USER,
      messageStr,
      imageUrls.length > 0 || attachments.length > 0
        ? {
          ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
          ...(attachments.length > 0 ? { attachments } : {}),
        }
        : undefined,
    );

    this.streamWorkflowResponse(
      req,
      res,
      id,
      userId,
      body.message,
      body.modelId,
      { images: imageUrls, sourceImages: body.sourceImages },
    );
  }

  @Post(':id/generate-image')
  async generateImage(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param('id') id: string,
    @Body()
    body: {
      model: string;
      chatModelId?: string;
      n?: number;
      templateId: string;
      variables?: Record<string, string>;
      promptOverride?: string;
      sourceImages?: Array<{
        url: string;
        prompt?: string;
        generationId?: string;
        index?: number;
      }>;
      referenceImages?: Array<{
        url: string;
        prompt?: string;
        generationId?: string;
        index?: number;
      }>;
      editInstruction?: string;
      settings?: {
        size?: string;
        quality?: string;
      };
    },
  ) {
    const userId = getCurrentUserId(user);
    await this.conversationService.findById(id, userId);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const fmt = (data: any): string => `data: ${JSON.stringify(data)}\n\n`;
    const timestamp = () => new Date().toISOString();
    const taskId = `img-${Date.now()}`;
    const count = Math.max(1, Math.min(body.n ?? 1, 4));

    try {
      const request = await this.imageGenerationFlowService.resolveImageRequest({
        userId,
        conversationId: id,
        templateId: body.templateId,
        modelConfigId: body.model,
        chatModelId: body.chatModelId,
        variables: body.variables,
        promptOverride: body.promptOverride,
        sourceImages: body.sourceImages,
        referenceImages: body.referenceImages,
        editInstruction: body.editInstruction,
        settings: body.settings,
      });

      res.write(fmt({
        messageType: request.mode === 'edit' ? 'image_editing' : 'image_generating',
        timestamp: timestamp(),
        payload: {
          taskId,
          model: request.modelConfig.model,
          count,
          sourceImages: request.sourceImages,
        },
      } as StreamMessage));

      const result = await this.imageGenerationFlowService.generateAndPersistImage(
        {
          userId,
          conversationId: id,
          templateId: body.templateId,
          modelConfigId: body.model,
          variables: body.variables,
          promptOverride: body.promptOverride,
          sourceImages: body.sourceImages,
          referenceImages: body.referenceImages,
          editInstruction: body.editInstruction,
          settings: body.settings,
        },
        request,
        count,
      );

      res.write(fmt({
        messageType: 'image_result',
        timestamp: timestamp(),
        payload: {
          taskId,
          images: result.images,
          prompt: result.prompt,
          model: result.model,
          sourceImages: request.sourceImages,
          referenceImages: request.referenceImages,
          appliedSettings: result.appliedSettings,
        },
      } as StreamMessage));
      res.write(fmt({ messageType: 'done', timestamp: timestamp(), payload: null } as StreamMessage));
    } catch (err) {
      res.write(fmt({
        messageType: 'error',
        timestamp: timestamp(),
        payload: { error: err instanceof Error ? err.message : 'Unknown error' },
      } as StreamMessage));
    } finally {
      res.end();
    }
  }

  private async streamWorkflowResponse(
    req: Request,
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

    const fmt = (data: any): string => `data: ${JSON.stringify(data)}\n\n`;

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
            message:
              typeof message === 'string' ? message : JSON.stringify(message),
            projectId,
            modelConfigId,
          });

          let persistedContent = '';
          for await (const event of videoStream) {
            this.emitWorkflowEvent(res, fmt, event);
            if (event.type === 'llm_token') persistedContent += event.content;
          }

          const durationMs = Date.now() - startedAt;
          if (persistedContent) {
            await this.messageService.addMessage(
              conversationId,
              MessageRole.ASSISTANT,
              persistedContent,
              { messageType: 'markdown', durationMs },
            );
          }

          res.write(fmt({
            messageType: 'done',
            timestamp: new Date().toISOString(),
            payload: { durationMs } as unknown as null,
          } as StreamMessage));
          return;
        }
      }

      const stream = this.orchestratorService.streamOrchestrate(
        message, '', userId, conversationId, modelConfigId, options,
      );

      let persistedContent = '';
      let persistedMetadata: Record<string, unknown> | undefined;

      for await (const event of stream) {
        this.emitWorkflowEvent(res, fmt, event);
        if (event.type === 'llm_token') persistedContent += event.content;
        if (event.type === 'prompt_suggestion') {
          persistedContent = event.prompt;
          persistedMetadata = {
            messageType: 'prompt_suggestion',
            prompt: event.prompt,
            model: event.model,
            reasoning: event.reasoning,
          };
        }
        if (event.type === 'edit_suggestion') {
          persistedContent = event.instruction;
          persistedMetadata = {
            messageType: 'edit_suggestion',
            instruction: event.instruction,
            sourceImages: event.sourceImages,
            model: event.model,
            reasoning: event.reasoning,
          };
        }
      }

      const durationMs = Date.now() - startedAt;

      if (persistedContent) {
        const baseMetadata = persistedMetadata ?? { messageType: 'markdown' };
        await this.messageService.addMessage(
          conversationId,
          MessageRole.ASSISTANT,
          persistedContent,
          { ...baseMetadata, durationMs },
        );
      }

      res.write(fmt({
        messageType: 'done',
        timestamp: new Date().toISOString(),
        payload: { durationMs } as unknown as null,
      } as StreamMessage));
    } catch (err) {
      this.logger.error('chat SSE error', err instanceof Error ? err.stack : String(err));
      res.write(fmt({
        messageType: 'error',
        timestamp: new Date().toISOString(),
        payload: { error: err instanceof Error ? err.message : 'Unknown error' },
      } as StreamMessage));
    } finally {
      this.processingRequests.delete(conversationId);
      res.end();
    }
  }

  private emitWorkflowEvent(res: Response, fmt: (d: any) => string, event: WorkflowStepEvent) {
    const ts = new Date().toISOString();
    switch (event.type) {
      case 'run_started':
        res.write(fmt({ messageType: 'log', timestamp: ts, payload: { level: 'info', message: `Workflow run started: ${event.runId}` } } as StreamMessage));
        break;
      case 'step_started':
        res.write(fmt({
          messageType: 'progress', timestamp: ts,
          payload: { stepKey: event.stepKey, displayName: event.displayName, index: event.index, total: event.total, status: 'started' } as ProgressPayload,
        } as StreamMessage));
        break;
      case 'llm_token':
        res.write(fmt({
          messageType: 'markdown', timestamp: ts,
          payload: { content: event.content, isChunk: true } as MarkdownPayload,
        } as StreamMessage));
        break;
      case 'prompt_suggestion':
        res.write(fmt({
          messageType: 'prompt_suggestion',
          timestamp: ts,
          payload: {
            prompt: event.prompt,
            model: event.model,
            reasoning: event.reasoning,
          },
        } as StreamMessage));
        break;
      case 'edit_suggestion':
        res.write(fmt({
          messageType: 'edit_suggestion',
          timestamp: ts,
          payload: {
            instruction: event.instruction,
            sourceImages: event.sourceImages,
            model: event.model,
            reasoning: event.reasoning,
          },
        } as StreamMessage));
        break;
      case 'image_generating':
        res.write(fmt({
          messageType: 'image_generating',
          timestamp: ts,
          payload: {
            taskId: event.taskId,
            model: event.model,
            count: event.count,
          },
        } as StreamMessage));
        break;
      case 'image_editing':
        res.write(fmt({
          messageType: 'image_editing',
          timestamp: ts,
          payload: {
            taskId: event.taskId,
            model: event.model,
            count: event.count,
            sourceImages: event.sourceImages,
          },
        } as StreamMessage));
        break;
      case 'image_generated':
        res.write(fmt({
          messageType: 'image_result',
          timestamp: ts,
          payload: {
            taskId: event.taskId,
            images: event.images,
            prompt: event.prompt,
            model: event.model,
            sourceImages: event.sourceImages,
          },
        } as StreamMessage));
        break;
      case 'step_artifact':
        res.write(fmt({
          messageType: 'step_artifact_created', timestamp: ts,
          payload: { stepKey: event.stepKey, artifactStepId: event.artifactStepId, contentType: event.contentType, version: event.version } as StepArtifactCreatedPayload,
        } as StreamMessage));
        break;
      case 'step_completed':
        res.write(fmt({
          messageType: 'step_completed', timestamp: ts,
          payload: { stepKey: event.stepKey, proposedNextStep: event.proposedNextStep, proposalReasoning: event.proposalReasoning, nextOptions: event.nextOptions } as StepCompletedPayload,
        } as StreamMessage));
        break;
      case 'step_failed':
        res.write(fmt({ messageType: 'step_failed', timestamp: ts, payload: { error: event.error } } as StreamMessage));
        break;
      case 'step_validation_failed':
        res.write(fmt({ messageType: 'step_validation_failed', timestamp: ts, payload: { stepKey: event.stepKey, reasons: event.reasons } } as StreamMessage));
        break;
      case 'step_refining':
        res.write(fmt({ messageType: 'step_refining', timestamp: ts, payload: { stepKey: event.stepKey, attempt: event.attempt, cause: event.cause } } as StreamMessage));
        break;
      case 'step_critic_evaluated':
        res.write(fmt({ messageType: 'step_critic_evaluated', timestamp: ts, payload: { stepKey: event.stepKey, score: event.score, passed: event.passed, feedback: event.feedback } } as StreamMessage));
        break;
      case 'points_consumed':
        res.write(fmt({
          messageType: 'points_consumed', timestamp: ts,
          payload: { stepKey: event.stepKey, points: event.points, balance: event.balance } as PointsConsumedPayload,
        } as StreamMessage));
        break;
      case 'run_paused':
        res.write(fmt({ messageType: 'run_paused', timestamp: ts, payload: { reason: event.reason } } as StreamMessage));
        break;
      case 'run_completed':
        res.write(fmt({ messageType: 'log', timestamp: ts, payload: { level: 'info', message: 'Workflow run completed' } } as StreamMessage));
        break;
      case 'log':
        res.write(fmt({ messageType: 'log', timestamp: ts, payload: { level: event.level, message: event.message, data: event.data } as LogPayload } as StreamMessage));
        break;
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
