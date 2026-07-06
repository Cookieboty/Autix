import type { ConversationMessage } from '@autix/shared-store';
import type { DrawElement, PersistedMessage } from './draw-scene-mapper';
import { sceneSignature } from './draw-scene-mapper';
import type { ChatMessage } from './draw-types';
import { asRecord } from './draw-workspace-helpers';

export function firstUserPrompt(messages: ChatMessage[]): string | null {
  return messages.find((m) => m.role === 'user')?.text ?? null;
}

export function toPersistedMessages(messages: ChatMessage[]): PersistedMessage[] {
  return messages
    .filter((m) => !m.pending)
    .map((m) => ({ id: m.id, role: m.role, text: m.text, images: m.images, videos: m.videos }));
}

export function combinedSignature(elements: readonly DrawElement[], conversation: readonly PersistedMessage[]): string {
  const conv = JSON.stringify(conversation.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    images: m.images ?? [],
    videos: m.videos ?? [],
  })));
  return `${sceneSignature(elements)}##${conv}`;
}

export function conversationMessageToChatMessage(message: ConversationMessage): ChatMessage {
  const metadata = asRecord(message.metadata);
  const images = extractImagesFromMetadata(metadata);
  const videos = extractUrlsFromMetadata(metadata, 'videos');
  return {
    id: message.id,
    role: message.role === 'USER' ? 'user' : 'assistant',
    text: message.content,
    images: images.length > 0 ? images : undefined,
    videos: videos.length > 0 ? videos : undefined,
    error: metadata?.messageType === 'error',
  };
}

export function extractImagesFromMetadata(metadata: Record<string, unknown> | null): string[] {
  return extractUrlsFromMetadata(metadata, 'images');
}

export function extractUrlsFromMetadata(metadata: Record<string, unknown> | null, key: string): string[] {
  if (!metadata) return [];
  const raw = metadata[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).url === 'string') {
        return (item as Record<string, string>).url;
      }
      return null;
    })
    .filter((url): url is string => Boolean(url));
}
