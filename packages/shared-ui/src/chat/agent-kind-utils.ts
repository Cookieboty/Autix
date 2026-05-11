import type { AgentKind } from '@autix/shared-lib';

export const KIND_ICON: Record<AgentKind, string> = {
  chat: '💬',
  image: '🖼',
  video: '🎬',
  avatar: '🧑',
};

export const KIND_LABEL: Record<AgentKind, string> = {
  chat: '对话',
  image: '图片',
  video: '视频',
  avatar: '数字人',
};

export const ALL_KINDS: AgentKind[] = ['chat', 'image', 'video', 'avatar'];

export const ACTIVE_KINDS: AgentKind[] = ['chat', 'image'];

export function isKindActive(kind: AgentKind): boolean {
  return ACTIVE_KINDS.includes(kind);
}
