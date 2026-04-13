/**
 * sub-agents.ts
 *
 * 导出创建 Agent 链的工厂函数，而非直接创建链实例。
 * 由 OrchestratorService 在运行时根据具体模型配置创建。
 *
 * 这样做是为了支持多模型切换：每次调用可以传入不同的模型实例。
 */
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  extractPrompt,
  clarifyPrompt,
  analysisPrompt,
  riskPrompt,
  summaryPrompt,
} from '../prompts';

/** 创建 extractAgent 链 */
export function createExtractAgent(model: BaseChatModel) {
  return extractPrompt.pipe(model).pipe(new StringOutputParser());
}

/** 创建 clarifyAgent 链 */
export function createClarifyAgent(model: BaseChatModel) {
  return clarifyPrompt.pipe(model).pipe(new StringOutputParser());
}

/** 创建 analysisAgent 链 */
export function createAnalysisAgent(model: BaseChatModel) {
  return analysisPrompt.pipe(model).pipe(new StringOutputParser());
}

/** 创建 riskAgent 链 */
export function createRiskAgent(model: BaseChatModel) {
  return riskPrompt.pipe(model).pipe(new StringOutputParser());
}

/** 创建 summaryAgent 链 */
export function createSummaryAgent(model: BaseChatModel) {
  return summaryPrompt.pipe(model).pipe(new StringOutputParser());
}
