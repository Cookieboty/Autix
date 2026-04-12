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
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { MessageService } from '../message/message.service';
import { DbChatHistory } from '../message/db-chat-history';
import { OrchestratorService } from '../llm/agents/orchestrator.service';
import { SearchService } from '../document/search.service';
import { MessageRole } from '@prisma/client';
import { loadLangChainConfig } from '../config/load-langchain-config';

@UseGuards(JwtAuthGuard)
@Controller('api/conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly orchestratorService: OrchestratorService,
    private readonly searchService: SearchService,
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
    return this.messageService.getHistory(id, safeLimit);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.conversationService.delete(id, userId);
  }

  @Post(':id/chat')
  async chat(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const userId = (req.user as any).userId;

    // 验证会话所有权（不存在抛 404，非本人抛 403）
    await this.conversationService.findById(id, userId);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // ── Step 1：持久化用户消息（DbChatHistory 会在 chain 内部追加历史）────────
      await this.messageService.addMessage(id, MessageRole.USER, body.message);

      // ── Step 2：RAG 语义检索 ────────────────────────────────────
      const config = loadLangChainConfig();
      const topK = config.retrieval?.topK ?? 5;

      let searchResults: Awaited<ReturnType<SearchService['similaritySearch']>> = [];
      try {
        searchResults = await this.searchService.similaritySearch(
          body.message,
          userId,
          topK,
        );
      } catch (searchErr) {
        console.warn('[chat] RAG 检索失败，继续无文档上下文分析:', searchErr);
      }

      // 格式化检索结果为 Agent 可读的文本块
      const retrievedContext =
        searchResults.length > 0
          ? searchResults
              .map(
                (r, i) =>
                  `[文档片段 ${i + 1}]（相关度：${r.score.toFixed(3)}）\n${r.content}`,
              )
              .join('\n\n')
          : '无相关参考文档';

      // ── Step 3：用 RunnableWithMessageHistory 自动管理历史 ──────────
      // DbChatHistory 通过 messageService 与 DB 交互，
      // RunnableWithMessageHistory 在调用链前后自动加载/保存消息，
      // 对 OrchestratorService 完全透明（只感知 { input }）。
      const chatHistory = new DbChatHistory(id, this.messageService);

      const chain = new RunnableWithMessageHistory({
        runnable: this.orchestratorService.asRunnable(),
        getMessageHistory: () => chatHistory,
        inputMessagesKey: 'input',
        historyMessagesKey: 'history',
      });

      // ── Step 4：运行多 Agent 编排 Pipeline ───────────────────────
      console.log(`[chat] 开始 Orchestrator Pipeline，会话 ${id}，用户 ${userId}`);
      const result = await chain.invoke(
        { input: body.message },
        {
          configurable: {
            sessionId: id,
            retrievedContext,
          },
        } as any, // retrievedContext 通过 asRunnable() 内部的 config.configurable 注入
      );
      console.log(
        `[chat] Pipeline 完成，使用 Agents: ${result.usedAgents.join(', ')}`,
      );

      // ── Step 5：SSE 推送主内容 ──────────────────────────────────
      const mainContent = result.needsClarification
        ? `需要进一步了解您的需求，请回答以下问题：\n\n${result.clarificationQuestions
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n')}`
        : (result.report ?? '分析完成，请查看摘要信息。');

      for (const line of mainContent.split('\n')) {
        if (line.trim() !== '') {
          res.write(`data: ${line}\n\n`);
        } else {
          res.write(`data:  \n\n`);
        }
      }

      // ── Step 6：持久化 AI 回复（含元数据）─────────────────────────
      const retrievedDocuments = searchResults.map((r) => ({
        documentId: r.documentId,
        content: r.content.slice(0, 200),
        score: r.score,
      }));

      await this.messageService.addMessage(
        id,
        MessageRole.ASSISTANT,
        mainContent,
        {
          usedAgents: result.usedAgents,
          retrievedDocuments,
          needsClarification: result.needsClarification,
          clarificationQuestions: result.clarificationQuestions,
          steps: result.steps,
        },
      );

      // ── Step 7：推送结构化 summary 事件 ─────────────────────────
      const summaryPayload = JSON.stringify({
        type: 'summary',
        usedAgents: result.usedAgents,
        retrievedDocuments,
        needsClarification: result.needsClarification,
        clarificationQuestions: result.clarificationQuestions,
      });
      res.write(`data: ${summaryPayload}\n\n`);

      // ── Step 8：发送结束标记 ────────────────────────────────────
      res.write('data: [DONE]\n\n');
    } catch (err) {
      console.error('[chat SSE error]', err);
      res.write('data: [ERROR]\n\n');
    } finally {
      res.end();
    }
  }
}
