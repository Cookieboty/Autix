import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { ConversationResourcesService } from './conversation-resources.service';
import { MessageService } from '../message/message.service';
import { OrchestratorService } from '../llm/agents/orchestrator.service';
import { AgentWorkflowService } from '../llm/workflow/agent-workflow.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { MessageRole, ResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArtifactService } from '../artifact/artifact.service';
import type {
  StreamMessage,
  MarkdownPayload,
  ProgressPayload,
  LogPayload,
  StepCompletedPayload,
  StepArtifactCreatedPayload,
  PointsConsumedPayload,
} from '../llm/ui-protocol/ui-types';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

@UseGuards(JwtAuthGuard)
@Controller('api/conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly orchestratorService: OrchestratorService,
    private readonly workflowService: AgentWorkflowService,
    private readonly modelConfigService: ModelConfigService,
    private readonly prisma: PrismaService,
    private readonly artifactService: ArtifactService,
    private readonly resourcesService: ConversationResourcesService,
  ) {}

  @Post()
  async create(@Req() req: Request, @Body() body: { title?: string }) {
    const userId = (req.user as any).userId;
    return this.conversationService.create(userId, body.title);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.conversationService.findByUser(userId);
  }

  @Get(':id/messages')
  async getMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req.user as any).userId;
    await this.conversationService.findById(id, userId);
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const safeLimit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : undefined;

    const messages = await this.messageService.getHistory(id, safeLimit);

    return messages.map((msg) => {
      const metadata = msg.metadata as Record<string, any> | null;
      const messageType = metadata?.messageType || 'markdown';

      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messageType,
        timestamp: msg.createdAt,
        metadata: {
          uiStage: metadata?.uiStage,
          retrievedDocuments: metadata?.retrievedDocuments,
        },
      };
    });
  }

  @Post(':id/messages')
  async appendMessage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { role: 'USER' | 'ASSISTANT'; content: string; metadata?: Record<string, unknown> },
  ) {
    const userId = (req.user as any).userId;
    await this.conversationService.findById(id, userId);
    const role = body.role === 'ASSISTANT' ? MessageRole.ASSISTANT : MessageRole.USER;
    return this.messageService.addMessage(id, role, body.content, body.metadata);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.conversationService.delete(id, userId);
  }

  // ── Agent Run API ───────────────────────────────────────────────────────

  @Get(':id/agent-run/active')
  async getActiveRun(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.conversationService.findById(id, userId);
    const run = await this.workflowService.getActiveRun(id);
    return run ?? null;
  }

  @Post(':id/agent-run/continue')
  async continueRun(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: { action: 'continue' | 'stop' | 'retry' | 'cancel'; stepKey?: string },
  ) {
    const userId = (req.user as any).userId;
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
  async cancelRun(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.conversationService.findById(id, userId);
    const run = await this.workflowService.getActiveRun(id);
    if (run) await this.workflowService.cancelRun(run.id);
    return { ok: true };
  }

  @Get(':id/step-artifacts')
  async listStepArtifacts(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.conversationService.findById(id, userId);
    const run = await this.workflowService.getActiveRun(id);
    if (!run) return [];
    return this.prisma.workflow_step_artifacts.findMany({
      where: { runId: run.id },
      orderBy: [{ stepKey: 'asc' }, { version: 'desc' }],
    });
  }

  // ── Chat (SSE) ──────────────────────────────────────────────────────────

  private processingRequests = new Map<string, { hash: string; timestamp: number }>();

  @Post(':id/chat')
  async chat(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: { message: string; modelId?: string },
  ) {
    const userId = (req.user as any).userId;
    await this.conversationService.findById(id, userId);

    const messageStr = typeof body.message === 'string' ? body.message : JSON.stringify(body.message);
    const msgHash = `${messageStr.length}:${messageStr.slice(0, 64)}`;
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
    await this.messageService.addMessage(id, MessageRole.USER, messageStr);

    this.streamWorkflowResponse(req, res, id, userId, body.message, body.modelId);
  }

  private async streamWorkflowResponse(
    req: Request,
    res: Response,
    conversationId: string,
    userId: string,
    message: string,
    modelId?: string,
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

      const stream = this.orchestratorService.streamOrchestrate(
        message, '', userId, conversationId, modelConfigId,
      );

      let persistedContent = '';

      for await (const event of stream) {
        this.emitWorkflowEvent(res, fmt, event);
        if (event.type === 'llm_token') persistedContent += event.content;
      }

      if (persistedContent) {
        await this.messageService.addMessage(
          conversationId, MessageRole.ASSISTANT, persistedContent, { messageType: 'markdown' },
        );
      }

      res.write(fmt({ messageType: 'done', timestamp: new Date().toISOString(), payload: null } as StreamMessage));
    } catch (err) {
      console.error('[chat SSE error]', err);
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

@UseGuards(JwtAuthGuard)
@Controller('api/conversations')
export class ConversationResourcesController {
  constructor(
    private readonly resourcesService: ConversationResourcesService,
  ) {}

  @Get(':id/resources')
  list(@Req() req: Request, @Param('id') conversationId: string) {
    const userId = (req.user as any).userId;
    return this.resourcesService.list(userId, conversationId);
  }

  @Post(':id/resources')
  attach(
    @Req() req: Request,
    @Param('id') conversationId: string,
    @Body() body: { resourceType: ResourceType; resourceId: string },
  ) {
    const userId = (req.user as any).userId;
    return this.resourcesService.attach(userId, conversationId, body.resourceType, body.resourceId);
  }

  @Delete(':id/resources/:type/:resourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async detach(
    @Req() req: Request,
    @Param('id') conversationId: string,
    @Param('type') typeStr: string,
    @Param('resourceId') resourceId: string,
  ) {
    const userId = (req.user as any).userId;
    await this.resourcesService.detach(userId, conversationId, typeStr.toUpperCase() as ResourceType, resourceId);
  }
}
