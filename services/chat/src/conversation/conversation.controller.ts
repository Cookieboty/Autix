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
import type { OrchestratorResult } from '../llm/ui-protocol/ui-types';
import { SearchService } from '../document/search.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { MessageRole } from '@prisma/client';
import { loadLangChainConfig } from '../config/load-langchain-config';
import { UIActionParser } from './ui-action.parser';
import { PrismaService } from '../prisma/prisma.service';
import { ArtifactService } from '../artifact/artifact.service';
import type { StreamMessage, MarkdownPayload, UIPayload, MetaPayload, ProgressPayload } from '../llm/ui-protocol/ui-types';

// Agent 名称映射
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  // 原有的 Agent 名称
  extractAgent: '需求提取',
  clarifyAgent: '澄清判断',
  analysisAgent: '多维度分析',
  riskAgent: '风险评估',
  summaryAgent: '综合报告',
  
  // Graph 节点名称（新增）
  classifierAgent: '意图分类',
  extractStep: '需求提取',
  clarifyStep: '澄清判断',
  analysisStep: '多维度分析',
  riskStep: '风险评估',
  summaryStep: '综合报告',
  queryAgent: '查询处理',
  queryHandler: '查询处理',
  chatAgent: '对话处理',
  chatHandler: '对话处理',
  requirementAnalysisGraph: '需求分析',
};

@UseGuards(JwtAuthGuard)
@Controller('api/conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly orchestratorService: OrchestratorService,
    private readonly searchService: SearchService,
    private readonly modelConfigService: ModelConfigService,
    private readonly uiActionParser: UIActionParser,
    private readonly prisma: PrismaService,
    private readonly artifactService: ArtifactService,
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
    
    // 转换消息格式,添加 messageType 和 interactionState
    return messages.map((msg) => {
      const metadata = msg.metadata as Record<string, any> | null;
      
      // 推断消息类型:如果有 messageType 字段则使用,否则根据 uiResponse 推断
      const messageType = metadata?.messageType || (metadata?.uiResponse ? 'ui' : 'markdown');
      
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        messageType,
        uiResponse: metadata?.uiResponse,
        interactionState: metadata?.interactionState,
        timestamp: msg.createdAt,
        metadata: {
          uiStage: metadata?.uiStage,
          usedAgents: metadata?.usedAgents,
          retrievedDocuments: metadata?.retrievedDocuments,
        },
      };
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.conversationService.delete(id, userId);
  }

  // 存储正在处理的请求（conversationId -> 最后处理的消息内容和时间）
  private processingRequests = new Map<string, { message: string; timestamp: number }>();

  @Post(':id/chat')
  async chat(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: { message: string; modelId?: string },
  ) {
    const userId = (req.user as any).userId;

    // 验证会话所有权（不存在抛 404，非本人抛 403）
    await this.conversationService.findById(id, userId);

    // 幂等性检查：防止短时间内处理相同消息
    const messageStr = typeof body.message === 'string' ? body.message : JSON.stringify(body.message);
    const existing = this.processingRequests.get(id);
    const now = Date.now();
    
    if (existing && existing.message === messageStr && (now - existing.timestamp) < 10000) {
      // 10秒内的重复请求，直接返回错误信息
      console.warn(`[chat] 拒绝重复请求，会话 ${id}，时间间隔 ${now - existing.timestamp}ms`);
      
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({type:'error',message:'请求正在处理中，请勿重复提交'})}\n\n`);
      res.end();
      return;
    }
    
    // 记录当前请求
    this.processingRequests.set(id, { message: messageStr, timestamp: now });

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
    
    // 立即发送响应头，启动流式传输
    res.flushHeaders();

    // SSE 格式化函数：将 JSON 对象转换为 SSE 格式
    const formatSSE = (data: any): string => {
      return `data: ${JSON.stringify(data)}\n\n`;
    };

    try {
      const isUIAction = typeof body.message === 'object' && body.message !== null;
      let uiContext = null;
      let messageContent = body.message;

      if (isUIAction) {
        // 获取最后一条 ASSISTANT 消息的 metadata 以读取 UI 状态
        // 注意：必须按 createdAt 降序获取最新的消息
        const lastMessages = await this.prisma.messages.findMany({
          where: { 
            conversationId: id,
            role: MessageRole.ASSISTANT 
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        const lastMessageMetadata = lastMessages.length > 0 ? lastMessages[0].metadata as Record<string, unknown> : undefined;
        
        uiContext = this.uiActionParser.parse(body.message, lastMessageMetadata);
        messageContent = JSON.stringify(body.message);
        // 记录用户对 UI 组件的操作,用于历史消息加载时禁用已操作组件
        if (lastMessages.length > 0 && lastMessages[0].metadata) {
          const lastMessage = lastMessages[0];
          const metadata = lastMessage.metadata as Record<string, any>;
          
          // 只有当消息包含 uiResponse 时才更新 interactionState
          if (metadata.uiResponse) {
            const interactionState = metadata.interactionState || {};
            const uiAction = body.message as any;

            interactionState[uiAction.componentId] = {
              action: uiAction.action,
              data: uiAction.data,
              timestamp: new Date().toISOString(),
              disabled: true,  // 标记为已禁用
            };

            // 更新数据库中的 interactionState
            await this.prisma.messages.update({
              where: { id: lastMessage.id },
              data: {
                metadata: {
                  ...metadata,
                  interactionState,
                },
              },
            });
          }
        }
      }

      // ── Step 1：持久化用户消息（仅对文本消息）────────────────────
      // UI 操作不保存为用户消息，只有真实的文本输入才保存
      if (!isUIAction) {
        await this.messageService.addMessage(id, MessageRole.USER, messageContent as string);
      }

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

      // ── Step 3：确定要使用的模型配置 ────────────────────────────
      let modelConfigId: string | undefined = body.modelId;
      if (!modelConfigId) {
        try {
          const defaultModel = await this.modelConfigService.findDefaultByTypeForUser(
            'general',
            userId,
          );
          modelConfigId = defaultModel?.id;
        } catch {
          // 无默认模型，orchestrator 会用 langchain.yaml
        }
      }

      // ── Step 4：使用流式 Orchestrator 进行真正的 token 级流式输出 ─────
      console.log(`[chat] 开始流式 Orchestrator Pipeline，会话 ${id}，用户 ${userId}，UI Stage: ${uiContext?.uiStage || 'none'}`);
      
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      let persistedContent = '';
      let finalResult: OrchestratorResult | null = null;
      let firstTokenSent = false;
      
      const retrievedDocuments = searchResults.map((r) => ({
        documentId: r.documentId,
        content: r.content.slice(0, 200),
        score: r.score,
      }));

      // 使用流式 API
      const stream = this.orchestratorService.streamOrchestrate(
        isUIAction ? messageContent : body.message,
        retrievedContext,
        modelConfigId,
        uiContext || undefined,
      );
      
      for await (const event of stream) {
        switch (event.type) {
          case 'agent_start':
            // 发送进度事件
            const progressStart: StreamMessage = {
              messageType: 'progress',
              timestamp: new Date().toISOString(),
              payload: {
                agent: event.agent,
                agentDisplayName: AGENT_DISPLAY_NAMES[event.agent] || event.agent,
                step: event.step,
                totalSteps: event.totalSteps,
                status: 'started',
              } as ProgressPayload,
            };
            res.write(formatSSE(progressStart));
            console.log(`[chat] Agent 开始: ${event.agent} (${event.step}/${event.totalSteps})`);
            break;
            
          case 'token':
            // 实时推送 Markdown token
            if (!firstTokenSent) {
              firstTokenSent = true;
              const firstChunk: StreamMessage = {
                messageType: 'markdown',
                timestamp: new Date().toISOString(),
                payload: {
                  messageId,
                  content: event.content,
                  isChunk: true,
                } as MarkdownPayload,
              };
              res.write(formatSSE(firstChunk));
            } else {
              const chunk: StreamMessage = {
                messageType: 'markdown',
                timestamp: new Date().toISOString(),
                payload: {
                  content: event.content,
                  isChunk: true,
                } as MarkdownPayload,
              };
              res.write(formatSSE(chunk));
            }
            persistedContent += event.content;
            break;
            
          case 'agent_end':
            // 发送完成进度事件
            const progressEnd: StreamMessage = {
              messageType: 'progress',
              timestamp: new Date().toISOString(),
              payload: {
                agent: event.agent,
                agentDisplayName: AGENT_DISPLAY_NAMES[event.agent] || event.agent,
                step: event.step,
                totalSteps: 5,
                status: 'completed',
              } as ProgressPayload,
            };
            res.write(formatSSE(progressEnd));
            console.log(`[chat] Agent 完成: ${event.agent}`);
            break;
            
          case 'log':
            // 发送日志事件
            const logMessage: StreamMessage = {
              messageType: 'log',
              timestamp: new Date().toISOString(),
              payload: {
                level: event.level,
                message: event.message,
                data: event.data,
              },
            };
            res.write(formatSSE(logMessage));
            console.log(`[chat] Log [${event.level}]: ${event.message}`);
            break;
            
          case 'final':
            finalResult = event.result;
            
            // 处理 UI 类型响应
            if (event.result.responseType === 'ui' && event.result.uiResponse) {
              const uiMessage: StreamMessage = {
                messageType: 'ui',
                timestamp: new Date().toISOString(),
                payload: {
                  messageId,
                  components: event.result.uiResponse.messages,
                  thinking: event.result.uiResponse.thinking,
                } as UIPayload,
              };
              res.write(formatSSE(uiMessage));
              persistedContent = '';
            }
            // 处理 Markdown 类型响应
            else if (event.result.responseType === 'markdown' && event.result.report) {
              // 如果之前没有通过 token 事件发送内容，现在一次性发送
              if (!persistedContent || persistedContent.trim().length === 0) {
                const markdownMessage: StreamMessage = {
                  messageType: 'markdown',
                  timestamp: new Date().toISOString(),
                  payload: {
                    messageId,
                    content: event.result.report,
                    isChunk: false,
                  } as MarkdownPayload,
                };
                res.write(formatSSE(markdownMessage));
                persistedContent = event.result.report;
              }
            }
            break;
        }
      }
      
      if (!finalResult) {
        throw new Error('流式输出未返回最终结果');
      }
      
      // 类型断言确保后续代码中 finalResult 不为 null
      const result: OrchestratorResult = finalResult;
      
      console.log(
        `[chat] Pipeline 完成，使用 Agents: ${result.usedAgents.join(', ')}，Next UI Stage: ${result.nextUIStage || 'none'}`,
      );

      const metaMessage: StreamMessage = {
        messageType: 'meta',
        timestamp: new Date().toISOString(),
        payload: {
          uiStage: result.nextUIStage,
          usedAgents: result.usedAgents,
          retrievedDocuments,
        } as MetaPayload,
      };
      res.write(formatSSE(metaMessage));

      let assistantMessageId: string;
      try {
        const assistantMessage = await this.messageService.addMessage(
          id,
          MessageRole.ASSISTANT,
          persistedContent,
          {
            messageType: result.responseType,
            usedAgents: result.usedAgents,
            retrievedDocuments,
            steps: result.steps,
            uiStage: result.nextUIStage,
            uiResponse: result.uiResponse,
            thinking: result.thinking,
            collectedData: uiContext?.collectedData,
            analysisResult: result.steps?.analysis,
            riskResult: result.steps?.risk,
          },
        );
        assistantMessageId = assistantMessage.id;
      } catch (dbError) {
        throw dbError;
      }

      // ── Step 5：检测并创建产物 ────────────────────────────────
      const shouldCreateArtifact =
        result.usedAgents?.includes('summaryAgent') &&
        result.steps?.summary &&
        result.steps.summary.trim().length > 0;

      if (shouldCreateArtifact) {
        try {
          // 使用 LLM 生成标题
          const title = await this.artifactService.generateTitle(
            result.steps.summary,
          );

          // 创建或更新产物（同时更新会话标题）
          const artifact = await this.artifactService.upsertArtifact({
            conversationId: id,
            userId,
            title,
            type: 'MARKDOWN',
            content: result.steps.summary,
            sourceMessageId: assistantMessageId,
          });

          // 发送 SSE 事件通知前端
          const artifactCreatedMessage: StreamMessage = {
            messageType: 'artifact_created',
            timestamp: new Date().toISOString(),
            payload: {
              artifactId: artifact.id,
              title: artifact.title,
            },
          };
          res.write(formatSSE(artifactCreatedMessage));

          console.log(
            `[chat] 创建产物成功: ${artifact.id}, 标题: ${artifact.title}`,
          );
        } catch (artifactError) {
          console.error('[chat] 创建产物失败:', artifactError);
        }
      }

      const doneMessage: StreamMessage = {
        messageType: 'done',
        timestamp: new Date().toISOString(),
        payload: null,
      };
      res.write(formatSSE(doneMessage));
    } catch (err) {
      console.error('[chat SSE error]', err);
      const errorMessage: StreamMessage = {
        messageType: 'error',
        timestamp: new Date().toISOString(),
        payload: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      };
      res.write(formatSSE(errorMessage));
    } finally {
      // 清理处理中的请求记录
      this.processingRequests.delete(id);
      res.end();
    }
  }

  /**
   * 将 UI 操作转换为友好的文本描述
   */
  private formatUIActionAsText(uiAction: any): string {
    const { action, data } = uiAction;

    // 根据不同的操作类型生成友好的文本
    if (action === 'submit') {
      if (data.selectedType) {
        // 选择类型
        const typeLabels: Record<string, string> = {
          new_feature: '新功能需求',
          bug_fix: '缺陷修复',
          optimization: '性能优化',
          refactoring: '代码重构',
        };
        const typeLabel = typeLabels[data.selectedType] || data.selectedType;
        return `选择需求类型：${typeLabel}`;
      } else if (data.requirementTitle || data.targetUsers) {
        // 表单提交
        const parts: string[] = [];
        if (data.requirementTitle) {
          parts.push(`需求标题：${data.requirementTitle}`);
        }
        if (data.targetUsers) {
          parts.push(`目标用户：${data.targetUsers}`);
        }
        if (data.businessGoal) {
          parts.push(`业务目标：${data.businessGoal}`);
        }
        if (data.functionalDescription) {
          parts.push(`功能描述：${data.functionalDescription}`);
        }
        return parts.join('\n');
      } else {
        // 通用提交
        return `确认提交`;
      }
    } else if (action === 'cancel') {
      return '取消操作';
    }

    // 默认情况
    return `执行操作：${action}`;
  }
}
