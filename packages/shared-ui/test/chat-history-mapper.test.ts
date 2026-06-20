import { describe, expect, test } from 'bun:test';
import { mapSessionMessagesToAIUIMessages } from '../src/chat/chat-history-mapper';

describe('chat history mapper', () => {
  test('preserves historical UI metadata and safe timestamps', () => {
    const messages = mapSessionMessagesToAIUIMessages([
      {
        id: 'm1',
        role: 'USER',
        content: 'hello',
        timestamp: '2026-01-02T03:04:05.000Z',
        metadata: { durationMs: 12 },
      },
      {
        id: 'm2',
        role: 'ASSISTANT',
        content: '',
        createdAt: 'invalid-date',
        uiResponse: { messages: [], thinking: 'top-level thinking' },
        metadata: {
          uiStage: 'workflow_done',
          interactionState: { confirm: { action: 'submit', data: {}, timestamp: 'now', disabled: true } },
        },
      },
    ]);

    expect(messages[0]).toMatchObject({
      id: 'm1',
      role: 'user',
      messageType: 'markdown',
      content: 'hello',
      durationMs: 12,
    });
    expect(messages[0]?.timestamp.toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(messages[1]).toMatchObject({
      id: 'm2',
      role: 'assistant',
      messageType: 'ui',
      thinking: 'top-level thinking',
      uiStage: 'workflow_done',
    });
    expect(messages[1]?.timestamp).toBeInstanceOf(Date);
  });

  test('uses metadata message type and thinking when top-level fields are absent', () => {
    const [message] = mapSessionMessagesToAIUIMessages([
      {
        id: 'image-result',
        role: 'assistant',
        content: '',
        timestamp: null,
        metadata: {
          messageType: 'image_result',
          thinking: 'metadata thinking',
        },
      },
    ]);

    expect(message).toMatchObject({
      id: 'image-result',
      role: 'assistant',
      messageType: 'image_result',
      thinking: 'metadata thinking',
    });
  });
});
