import { createAIUIClient } from '@autix/sdk';
import type { SSEEvent, UIAction } from '@autix/domain/ai-ui';

export function sendAIUIMessage(
  conversationId: string,
  message: string | UIAction,
  modelId?: string,
): AsyncGenerator<SSEEvent> {
  return createAIUIClient().sendMessage(conversationId, message, modelId);
}
