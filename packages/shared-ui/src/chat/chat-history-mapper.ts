import type { ChatMessage } from '@autix/shared-store';

interface ChatHistoryMessage {
  id: string;
  role?: string;
  content?: string;
  createdAt?: string | null;
  timestamp?: string | null;
  messageType?: string;
  uiResponse?: unknown;
  thinking?: unknown;
  metadata?: unknown;
  durationMs?: unknown;
}

type MutableAIMessage = Omit<
  ChatMessage,
  'messageType' | 'metadata' | 'uiResponse' | 'interactionState' | 'uiStage'
> & {
  messageType?: string;
  metadata: Record<string, unknown>;
  payload: Record<string, unknown>;
  uiResponse?: unknown;
  interactionState?: unknown;
  uiStage?: unknown;
  thinking?: string;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toSafeDate(value: string | null | undefined): Date {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

function readNestedThinking(value: unknown): string | undefined {
  const record = toRecord(value);
  return typeof record.thinking === 'string' ? record.thinking : undefined;
}

export function mapSessionMessagesToAIUIMessages(
  messages: ChatHistoryMessage[],
): ChatMessage[] {
  return messages.map((msg) => {
    const metadata = toRecord(msg.metadata);
    const messageType =
      msg.messageType ||
      (typeof metadata.messageType === 'string' ? metadata.messageType : undefined) ||
      (msg.uiResponse || metadata.uiResponse ? 'ui' : 'markdown');

    const aiMsg: MutableAIMessage = {
      id: msg.id,
      role: msg.role?.toUpperCase() === 'USER' ? 'user' : 'assistant',
      messageType,
      content: msg.content ?? '',
      payload: metadata,
      metadata,
      timestamp: toSafeDate(msg.createdAt ?? msg.timestamp),
      durationMs:
        typeof msg.durationMs === 'number'
          ? msg.durationMs
          : typeof metadata.durationMs === 'number'
            ? metadata.durationMs
            : undefined,
    };

    const uiResponse = msg.uiResponse ?? metadata.uiResponse;
    if (uiResponse) {
      aiMsg.uiResponse = uiResponse;
    }
    if (metadata.uiStage) {
      aiMsg.uiStage = metadata.uiStage;
    }
    if (metadata.interactionState) {
      aiMsg.interactionState = metadata.interactionState;
    }

    if (typeof msg.thinking === 'string') {
      aiMsg.thinking = msg.thinking;
    } else {
      const responseThinking = readNestedThinking(msg.uiResponse);
      const metadataThinking =
        typeof metadata.thinking === 'string' ? metadata.thinking : undefined;
      aiMsg.thinking = responseThinking ?? metadataThinking;
    }

    return aiMsg as ChatMessage;
  });
}
