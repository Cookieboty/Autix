/**
 * llm.prompts.ts
 *
 * LlmService 中 createChain() 所用的通用助手提示词。
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

export const GENERAL_ASSISTANT_SYSTEM = `你是一个智能助手，请根据用户的问题给出简洁、准确的回答。`;

export const generalAssistantPrompt = ChatPromptTemplate.fromMessages([
  ['system', GENERAL_ASSISTANT_SYSTEM],
]);
