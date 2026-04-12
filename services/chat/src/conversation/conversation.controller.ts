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
import { MessageService } from '../message/message.service';
import { LlmService } from '../llm/llm.service';
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
    private readonly llmService: LlmService,
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

    // 设置 SSE 响应头（保持与原有协议一致）
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // ── Step 1：持久化用户消息 ─────────────────────────────────
      await this.messageService.addMessage(id, MessageRole.USER, body.message);

      // ── Step 2：读取历史消息，拼接上下文 ──────────────────────────
      // 将历史记录序列化为文本，注入 extractAgent 的 input，
      // 使 Agent 感知多轮对话上下文
      const history = await this.messageService.getHistory(id);
      const historyContext =
        history.length > 1
          ? history
              .slice(0, -1) // 去掉刚刚存的用户消息（最后一条）
              .slice(-6) // 只取最近 6 条（3轮对话）避免 token 超限
              .map((m) => `${m.role === MessageRole.USER ? '用户' : '助手'}：${m.content}`)
              .join('\n')
          : '';

      const inputWithContext = historyContext
        ? `【对话历史】\n${historyContext}\n\n【当前需求】\n${body.message}`
        : body.message;

      // ── Step 3：RAG 语义检索 ────────────────────────────────────
      // 读取 langchain.yaml 中的 retrieval.topK 配置（默认 5）
      const config = loadLangChainConfig();
      const topK = config.retrieval?.topK ?? 5;

      let searchResults: Awaited<ReturnType<SearchService['similaritySearch']>> = [];
      try {
        searchResults = await this.searchService.similaritySearch(
          body.message, // 用当前轮消息检索，不带历史（避免检索偏移）
          userId,
          topK,
        );
      } catch (searchErr) {
        // 检索失败不阻断主流程，记录日志后继续
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

      // ── Step 4：运行多 Agent 编排 Pipeline ───────────────────────
      console.log(`[chat] 开始 Orchestrator Pipeline，会话 ${id}，用户 ${userId}`);
      const result = await this.orchestratorService.orchestrate(
        inputWithContext,
        retrievedContext,
      );
      console.log(
        `[chat] Pipeline 完成，使用 Agents: ${result.usedAgents.join(', ')}`,
      );

      // ── Step 5：SSE 推送主内容 ──────────────────────────────────
      // 确定推送内容：
      //   - 正常完成 → 推送 report（需求分析报告 Markdown）
      //   - 需要澄清 → 推送澄清问题列表
      const mainContent = result.needsClarification
        ? `需要进一步了解您的需求，请回答以下问题：\n\n${result.clarificationQuestions
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n')}`
        : (result.report ?? '分析完成，请查看摘要信息。');

      // 逐行发送 SSE（模拟流式输出，前端 SSE 处理器逐行拼接）
      for (const line of mainContent.split('\n')) {
        if (line.trim() !== '') {
          res.write(`data: ${line}\n\n`);
        } else {
          // 空行用空格代替，保留段落分隔感
          res.write(`data:  \n\n`);
        }
      }

      // ── Step 6：持久化 AI 回复（含元数据）─────────────────────────
      // retrievedDocuments 只存前 200 字，避免 metadata 字段过大
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
      // 前端通过监听 type==="summary" 的事件获取结构化结果
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
