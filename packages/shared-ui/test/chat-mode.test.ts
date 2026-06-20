import { describe, expect, test } from 'bun:test';
import {
  normalizeConversationKind,
  resolveActiveAgentKind,
  toVisibleInputMode,
} from '../src/chat/chat-mode';

describe('chat mode helpers', () => {
  test('normalizes only supported visible conversation kinds', () => {
    expect(normalizeConversationKind('chat')).toBe('chat');
    expect(normalizeConversationKind('image')).toBe('image');
    expect(normalizeConversationKind('video')).toBe('video');
    expect(normalizeConversationKind('avatar')).toBeNull();
    expect(normalizeConversationKind(undefined)).toBeNull();
  });

  test('prefers explicit input mode over session and agent hints', () => {
    expect(
      resolveActiveAgentKind({
        inputModeOverride: 'chat',
        sessionKind: 'image',
        agentKind: 'video',
        hasActiveVideoTemplate: true,
        hasImageHistory: true,
      }),
    ).toBe('chat');
  });

  test('keeps video sticky when a video template is active', () => {
    expect(
      resolveActiveAgentKind({
        inputModeOverride: null,
        sessionKind: null,
        agentKind: 'chat',
        hasActiveVideoTemplate: true,
        hasImageHistory: false,
      }),
    ).toBe('video');
  });

  test('keeps image sticky when image history exists', () => {
    expect(
      resolveActiveAgentKind({
        inputModeOverride: null,
        sessionKind: null,
        agentKind: 'chat',
        hasActiveVideoTemplate: false,
        hasImageHistory: true,
      }),
    ).toBe('image');
  });

  test('falls back to session, agent, then chat', () => {
    expect(
      resolveActiveAgentKind({
        inputModeOverride: null,
        sessionKind: 'avatar',
        agentKind: 'video',
        hasActiveVideoTemplate: false,
        hasImageHistory: false,
      }),
    ).toBe('avatar');
    expect(
      resolveActiveAgentKind({
        inputModeOverride: null,
        sessionKind: null,
        agentKind: 'video',
        hasActiveVideoTemplate: false,
        hasImageHistory: false,
      }),
    ).toBe('video');
    expect(
      resolveActiveAgentKind({
        inputModeOverride: null,
        sessionKind: null,
        hasActiveVideoTemplate: false,
        hasImageHistory: false,
      }),
    ).toBe('chat');
  });

  test('maps non-image/video agent kinds to visible chat mode', () => {
    expect(toVisibleInputMode('image')).toBe('image');
    expect(toVisibleInputMode('video')).toBe('video');
    expect(toVisibleInputMode('chat')).toBe('chat');
    expect(toVisibleInputMode('avatar')).toBe('chat');
  });
});
