import {
  schemaParamsToVideoClipParams,
  videoClipParamsToSchemaParams,
} from '../src/video/workbench/schema-params-mapping';

describe('schemaParamsToVideoClipParams', () => {
  // 原生化后 schema 直接叫 duration，与 clip 同名——恒等透传，不再改名。
  test('passes native duration through unchanged', () => {
    expect(schemaParamsToVideoClipParams({ duration: 8 })).toEqual({ duration: 8 });
  });

  // 回归守卫：schema 早已不再产出 `seconds`；若有人把恒等写回成读 `seconds`，
  // 表单里选的时长会被静默丢弃（native-ization 泄漏），这条会红。
  test('ignores an orphan `seconds` key (schema no longer emits it)', () => {
    const result = schemaParamsToVideoClipParams({ seconds: 8, resolution: '1080p', ratio: '16:9' });
    expect(result).not.toHaveProperty('seconds');
    expect(result).not.toHaveProperty('duration');
    expect(result).toEqual({ resolution: '1080p', ratio: '16:9' });
  });

  test('passes resolution and ratio through unchanged', () => {
    expect(
      schemaParamsToVideoClipParams({ resolution: '1080p', duration: 5, ratio: '9:16' }),
    ).toEqual({ duration: 5, resolution: '1080p', ratio: '9:16' });
  });

  test('only maps keys present in the input', () => {
    expect(schemaParamsToVideoClipParams({ resolution: '720p' })).toEqual({ resolution: '720p' });
    expect(schemaParamsToVideoClipParams({})).toEqual({});
  });
});

describe('videoClipParamsToSchemaParams (reverse, form init/sync)', () => {
  test('passes duration/resolution/ratio through unchanged (all identity)', () => {
    expect(
      videoClipParamsToSchemaParams({ duration: 8, resolution: '1080p', ratio: '16:9' }),
    ).toEqual({ duration: 8, resolution: '1080p', ratio: '16:9' });
  });

  test('only maps the three pricing keys; drops non-pricing clip params (audio/seed)', () => {
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
