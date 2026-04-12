/**
 * sub-agents.ts
 *
 * 定义需求分析流水线中的五个 Agent 链。
 * 每个 Agent = ChatPromptTemplate | ChatOpenAI | StringOutputParser
 * 全部为模块级常量导出，供 OrchestratorService 调用。
 *
 * 提示词模板统一从 ../prompts/ 目录导入，
 * 保持模板内容与链构建逻辑分离。
 *
 * 依赖：
 *   - ../prompts/：ChatPromptTemplate 对象（已包含消息内容）
 *   - createChatModel()：读取 config/langchain.yaml + 环境变量
 *   - @langchain/core/output_parsers：StringOutputParser
 */
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createChatModel } from '../model.factory';
import {
  extractPrompt,
  clarifyPrompt,
  analysisPrompt,
  riskPrompt,
  summaryPrompt,
} from '../prompts';

// 所有 Agent 共用同一个模型实例（模块加载时初始化一次）
const model = createChatModel();
const parser = new StringOutputParser();

export const extractAgent = extractPrompt.pipe(model).pipe(parser);

export const clarifyAgent = clarifyPrompt.pipe(model).pipe(parser);

export const analysisAgent = analysisPrompt.pipe(model).pipe(parser);

export const riskAgent = riskPrompt.pipe(model).pipe(parser);

export const summaryAgent = summaryPrompt.pipe(model).pipe(parser);
