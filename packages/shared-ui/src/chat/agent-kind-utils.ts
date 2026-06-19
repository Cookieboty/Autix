import type { AgentKind } from '@autix/shared-lib';

export const KIND_ICON: Record<AgentKind, string> = {
  chat: '💬',
  image: '🖼',
  video: '🎬',
  avatar: '🧑',
};

export const KIND_LABEL_KEY: Record<AgentKind, 'chat' | 'image' | 'video' | 'avatar'> = {
  chat: 'chat',
  image: 'image',
  video: 'video',
  avatar: 'avatar',
};

export const ALL_KINDS: AgentKind[] = ['chat', 'image', 'video', 'avatar'];

export const WORKBENCH_VISIBLE_KINDS: AgentKind[] = ['chat', 'image', 'video'];

export const ACTIVE_KINDS: AgentKind[] = ['chat', 'image', 'video'];

export function isKindActive(kind: AgentKind): boolean {
  return ACTIVE_KINDS.includes(kind);
}
