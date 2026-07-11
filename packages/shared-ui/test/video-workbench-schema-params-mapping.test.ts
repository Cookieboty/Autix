import { describe, expect, test } from 'bun:test';
import {
  schemaParamsToVideoClipParams,
  videoClipParamsToSchemaParams,
} from '../src/video/workbench/schema-params-mapping';

describe('schemaParamsToVideoClipParams', () => {
  test('renames seconds to duration (task 7 DoD example / CRITICAL 1)', () => {
    expect(schemaParamsToVideoClipParams({ seconds: 8 })).toEqual({ duration: 8 });
  });

  test('an implementation that drops the rename (orphan `seconds` key) must fail this test', () => {
    const result = schemaParamsToVideoClipParams({ seconds: 8, resolution: '1080p', ratio: '16:9' });
    expect(result).not.toHaveProperty('seconds');
    expect(result.duration).toBe(8);
  });

  test('passes resolution and ratio through unchanged (key and value already match clip params)', () => {
    expect(
      schemaParamsToVideoClipParams({ resolution: '1080p', seconds: 5, ratio: '9:16' }),
    ).toEqual({ duration: 5, resolution: '1080p', ratio: '9:16' });
  });

  test('only maps keys present in the input', () => {
    expect(schemaParamsToVideoClipParams({ resolution: '720p' })).toEqual({ resolution: '720p' });
    expect(schemaParamsToVideoClipParams({})).toEqual({});
  });
});

describe('videoClipParamsToSchemaParams (reverse, P1-3 form init/sync)', () => {
  test('renames duration to seconds, passes resolution/ratio through', () => {
    expect(
      videoClipParamsToSchemaParams({ duration: 8, resolution: '1080p', ratio: '16:9' }),
    ).toEqual({ seconds: 8, resolution: '1080p', ratio: '16:9' });
  });

  test('only maps keys present; ignores non-pricing clip params (audio/seed)', () => {
    expect(
      videoClipParamsToSchemaParams({ generateAudio: true, seed: 42, resolution: '720p' }),
    ).toEqual({ resolution: '720p' });
    expect(videoClipParamsToSchemaParams({})).toEqual({});
  });

  // Idempotent round-trip guards useSchemaFormExternalSync against a
  // clipParams -> form -> clipParams loop and against the mount sync
  // overwriting an existing clip's params with schema defaults.
  test('round-trip clipParams -> schema params -> clipParams is stable', () => {
    for (const clip of [
      { duration: 8, resolution: '1080p', ratio: '16:9' },
      { duration: 5, resolution: '720p', ratio: '9:16' },
      { duration: 4, resolution: '480p', ratio: '1:1' },
    ]) {
      const schemaParams = videoClipParamsToSchemaParams(clip);
      expect(schemaParamsToVideoClipParams(schemaParams)).toEqual(clip);
    }
  });
});
