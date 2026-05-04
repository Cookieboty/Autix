import { createDeepAgent, type SubAgent } from 'deepagents';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';

export interface DeepAgentFactoryOptions {
  model: BaseChatModel;
  systemPrompt: string;
  tools?: StructuredToolInterface[];
  subagents?: SubAgent[];
  checkpointer?: PostgresSaver;
  threadId?: string;
}

/**
 * 封装 createDeepAgent，返回可 invoke/stream 的编译后 LangGraph graph。
 * 返回 any 以避免跨包类型推断问题（deepagents 内嵌 zod@4 与项目 zod@3 冲突）。
 */
export function createStepAgent(options: DeepAgentFactoryOptions): ReturnType<typeof createDeepAgent> {
  return createDeepAgent({
    model: options.model,
    systemPrompt: options.systemPrompt,
    tools: options.tools ?? [],
    subagents: options.subagents ?? [],
  });
}

/**
 * 创建 PostgresSaver checkpointer 实例。
 * 复用项目已有的 PG 连接字符串。
 */
export async function createCheckpointer(connectionString: string): Promise<PostgresSaver> {
  const checkpointer = PostgresSaver.fromConnString(connectionString);
  await checkpointer.setup();
  return checkpointer;
}
