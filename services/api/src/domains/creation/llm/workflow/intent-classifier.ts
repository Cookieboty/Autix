import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export type IntentClass = 'workflow_trigger' | 'normal_chat' | 'continue_run';

export async function classifyIntent(
  model: BaseChatModel,
  userMessage: string,
  hasActiveRun: boolean,
  lastStepKey?: string,
  systemPrompt?: string,
): Promise<IntentClass> {
  if (!systemPrompt) throw new Error('intent classifier system prompt is required');
  const contextLine = hasActiveRun
    ? `There is a workflow in progress (paused at step: ${lastStepKey ?? 'unknown'}).`
    : 'There is no workflow in progress.';

  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`${contextLine}\n\nUser message: ${userMessage}`),
  ]);

  const text = typeof result.content === 'string'
    ? result.content.trim().toLowerCase()
    : '';

  if (text.includes('workflow_trigger')) return 'workflow_trigger';
  if (text.includes('continue_run')) return 'continue_run';
  return 'normal_chat';
}
