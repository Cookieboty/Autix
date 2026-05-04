import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export type IntentClass = 'workflow_trigger' | 'normal_chat' | 'continue_run';

const CLASSIFIER_SYSTEM = `你是一个意图分类器。根据用户消息和上下文，输出以下三个分类之一（仅输出分类标签，不要其他文字）：

- workflow_trigger — 用户明确描述了一个产品/项目/功能需求（如"做一个待办应用"、"帮我生成一个电商首页"），且当前没有进行中的工作流。
- continue_run — 当前有暂停的工作流，且用户消息是继续/补充/确认类（如"继续"、"下一步"、"好的"）。
- normal_chat — 闲聊、普通问答、与工作流无关的消息。

判断规则：
1. 如果没有 active run 且消息描述了具体产品需求 → workflow_trigger
2. 如果有 active run 且消息是确认/继续/补充 → continue_run
3. 其他一律 → normal_chat`;

export async function classifyIntent(
  model: BaseChatModel,
  userMessage: string,
  hasActiveRun: boolean,
  lastStepKey?: string,
): Promise<IntentClass> {
  const contextLine = hasActiveRun
    ? `当前有进行中的工作流（暂停在 step: ${lastStepKey ?? '未知'}）。`
    : '当前没有进行中的工作流。';

  const result = await model.invoke([
    new SystemMessage(CLASSIFIER_SYSTEM),
    new HumanMessage(`${contextLine}\n\n用户消息: ${userMessage}`),
  ]);

  const text = typeof result.content === 'string'
    ? result.content.trim().toLowerCase()
    : '';

  if (text.includes('workflow_trigger')) return 'workflow_trigger';
  if (text.includes('continue_run')) return 'continue_run';
  return 'normal_chat';
}
