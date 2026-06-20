import type { AgentKind, ConversationKind } from '@autix/shared-store';
import type { InputMode } from './InputModeSwitch';

export function normalizeConversationKind(
  kind: ConversationKind | null | undefined,
): InputMode | null {
  return kind === 'chat' || kind === 'image' || kind === 'video' ? kind : null;
}

export function resolveActiveAgentKind(params: {
  inputModeOverride: InputMode | null;
  sessionKind: ConversationKind | null | undefined;
  agentKind?: AgentKind;
  hasActiveVideoTemplate: boolean;
  hasImageHistory: boolean;
}): AgentKind {
  const sessionInputMode = normalizeConversationKind(params.sessionKind);
  const explicitInputMode = params.inputModeOverride ?? sessionInputMode;

  if (explicitInputMode === 'chat') return 'chat';
  if (explicitInputMode === 'image') return 'image';
  if (explicitInputMode === 'video' || params.hasActiveVideoTemplate) return 'video';
  if (params.hasImageHistory) return 'image';
  return (params.sessionKind as AgentKind | undefined) ?? params.agentKind ?? 'chat';
}

export function toVisibleInputMode(kind: AgentKind): InputMode {
  return kind === 'image' || kind === 'video' ? kind : 'chat';
}
