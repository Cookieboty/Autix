import { describe, expect, test } from 'bun:test';
import {
  parseImageDraftQuery,
  coerceImageDraft,
  parseVideoDraftQuery,
  coerceVideoDraft,
  parseGenerateAudioParam,
} from '../src/workbench/generator-draft-query';

const getter = (map: Record<string, string>) => (k: string) => map[k] ?? null;

describe('image draft', () => {
  test('parses known keys', () => {
    expect(
      parseImageDraftQuery(getter({ prompt: 'hi', size: '1024x1024', quality: 'high', count: '3' })),
    ).toEqual({ prompt: 'hi', size: '1024x1024', quality: 'high', count: 3 });
  });

  test('coerce drops values not in capability and clamps count', () => {
    expect(
      coerceImageDraft(
        { size: 'bogus', quality: 'ultra', count: 9 },
        { sizes: ['1024x1024'], qualities: ['high'], maxCount: 4 },
      ),
    ).toEqual({ count: 4 });
  });

  test('coerce drops count when maxCount is 1', () => {
    expect(
      coerceImageDraft({ count: 4 }, { sizes: [], qualities: [], maxCount: 1 }),
    ).toEqual({});
  });
});

describe('video draft', () => {
  test('parses and normalizes', () => {
    const d = parseVideoDraftQuery(
      getter({ prompt: 'x', duration: '8.4', resolution: '1080p', ratio: '16:9', generateAudio: '1', mode: 'standard', draftId: 'draft_1' }),
    );
    expect(d).toEqual({
      prompt: 'x',
      duration: 9,
      resolution: '1080p',
      ratio: '16:9',
      generateAudio: true,
      mode: 'standard',
      draftId: 'draft_1',
    });
  });

  test('coerce drops resolution not supported and invalid ratio/mode', () => {
    expect(
      coerceVideoDraft(
        { resolution: '4k', ratio: 'banana', mode: 'nope' },
        { resolutions: ['480p', '720p'] },
      ),
    ).toEqual({});
  });

  test('coerce keeps supported resolution and valid ratio', () => {
    expect(
      coerceVideoDraft(
        { resolution: '720p', ratio: '9:16', mode: 'storyboard' },
        { resolutions: ['480p', '720p'] },
      ),
    ).toEqual({ resolution: '720p', ratio: '9:16', mode: 'storyboard' });
  });
});

describe('parseGenerateAudioParam', () => {
  test('maps true/false strings', () => {
    expect(parseGenerateAudioParam('1')).toBe(true);
    expect(parseGenerateAudioParam('true')).toBe(true);
    expect(parseGenerateAudioParam('0')).toBe(false);
    expect(parseGenerateAudioParam('false')).toBe(false);
    expect(parseGenerateAudioParam('yes')).toBeUndefined();
    expect(parseGenerateAudioParam(null)).toBeUndefined();
  });
});
