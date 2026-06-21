import type { ChatMessage } from '@autix/shared-store';
import type { ImageResultItem } from '../MessageBubble';

export type ChatViewMessagePayload = Record<string, unknown> & {
  images?: unknown;
  attachments?: unknown;
  prompt?: string;
  generationId?: string;
  sourceImages?: ImageResultItem[];
  taskId?: string;
};

export type ChatViewMessage = Omit<ChatMessage, 'messageType' | 'metadata'> & {
  messageType?: string;
  payload?: ChatViewMessagePayload;
  metadata?: ChatViewMessagePayload;
  createdAt?: Date | string | number | null;
};
