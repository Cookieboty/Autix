import type {
  AgentKind,
  ChatAttachment,
  ChatAttachmentKind,
} from '@autix/shared-store';

export interface ChatAttachmentInput {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface LocalChatAttachment extends ChatAttachmentInput {
  id: string;
  kind: ChatAttachmentKind;
  file?: File;
}

export type ChatInputAction = 'chat' | 'image';

export const CHAT_ATTACHMENT_ACCEPT = [
  'image/*',
  'video/*',
  'audio/*',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

const ALLOWED_FILE_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  ogg: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
};

export function getAttachmentKind(mimeType: string): ChatAttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

export function inferAttachmentMimeType(url: string): string {
  const cleanUrl = url.split(/[?#]/)[0] ?? url;
  const ext = cleanUrl.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME_TYPES[ext] ?? 'application/octet-stream';
}

export function createTemplateAttachment(url: string, index: number): ChatAttachmentInput {
  const inferredMimeType = inferAttachmentMimeType(url);
  const mimeType = inferredMimeType === 'application/octet-stream'
    ? 'image/jpeg'
    : inferredMimeType;
  return {
    url,
    name: `template-media-${index + 1}`,
    mimeType,
    size: 0,
  };
}

export function isSupportedChatAttachment(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    file.type.startsWith('video/') ||
    file.type.startsWith('audio/') ||
    ALLOWED_FILE_MIME_TYPES.has(file.type)
  );
}

export function normalizeChatAttachments(items: ChatAttachmentInput[]): ChatAttachment[] {
  return items
    .filter((item) => item.url && item.name && item.mimeType && Number.isFinite(item.size))
    .map((item) => ({
      ...item,
      kind: getAttachmentKind(item.mimeType),
    }));
}

export function getChatImageUrls(attachments: ChatAttachment[]): string[] {
  return attachments
    .filter((attachment) => attachment.kind === 'image')
    .map((attachment) => attachment.url);
}

export function shouldUseImageGeneration({
  mode,
  action,
}: {
  mode: AgentKind;
  action: ChatInputAction;
}): boolean {
  return mode === 'image' && action === 'image';
}
