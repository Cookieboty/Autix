import { describe, expect, it } from 'bun:test';
import {
  conversationMessageToChatMessage,
  toPersistedMessages,
} from '../src/draw/draw-message-helpers';

describe('draw message helpers', () => {
  it('filters pending chat messages before persistence', () => {
    expect(toPersistedMessages([
      { id: 'm1', role: 'user', text: 'keep me' },
      { id: 'm2', role: 'assistant', text: 'skip me', pending: true },
    ])).toEqual([
      { id: 'm1', role: 'user', text: 'keep me', images: undefined, videos: undefined },
    ]);
  });

  it('maps conversation metadata URLs into chat messages', () => {
    const message = conversationMessageToChatMessage({
      id: 'm1',
      role: 'ASSISTANT',
      content: 'done',
      metadata: {
        images: ['https://cdn.test/a.png', { url: 'https://cdn.test/b.png' }, { bad: true }],
        videos: [{ url: 'https://cdn.test/v.mp4' }],
        messageType: 'error',
      },
    } as never);

    expect(message).toEqual({
      id: 'm1',
      role: 'assistant',
      text: 'done',
      images: ['https://cdn.test/a.png', 'https://cdn.test/b.png'],
      videos: ['https://cdn.test/v.mp4'],
      error: true,
    });
  });
});
