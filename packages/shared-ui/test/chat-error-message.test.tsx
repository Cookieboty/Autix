import { describe, expect, test } from 'bun:test';
import { splitErrorMessage } from '../src/chat/chat-error-message';

describe('chat error message helpers', () => {
  test('uses the fallback title for blank errors', () => {
    expect(splitErrorMessage('   ', 'Request failed')).toEqual({
      title: 'Request failed',
      body: '',
    });
  });

  test('splits title and body at sentence boundaries', () => {
    expect(splitErrorMessage('Failed. Try again later', 'Fallback')).toEqual({
      title: 'Failed',
      body: 'Try again later',
    });
    expect(splitErrorMessage('失败。请稍后再试', 'Fallback')).toEqual({
      title: '失败',
      body: '请稍后再试',
    });
  });

  test('keeps the original unicode ellipsis behavior for long titles', () => {
    const raw = 'x'.repeat(81);
    expect(splitErrorMessage(raw, 'Fallback')).toEqual({
      title: `${'x'.repeat(80)}…`,
      body: '',
    });
  });
});
