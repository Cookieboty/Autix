import { describe, expect, it } from 'vitest';
import {
  readImageMaxCount,
  readImageModelMetadata,
  supportsImageOperation,
} from './image-metadata';

describe('readImageModelMetadata', () => {
  it('reads the four fields from a well-formed metadata blob', () => {
    expect(
      readImageModelMetadata({
        modelFamily: 'gemini-image',
        protocolKey: 'openai-images',
        operations: ['generate', 'edit'],
        limits: { maxCount: 4 },
      }),
    ).toEqual({
      modelFamily: 'gemini-image',
      protocolKey: 'openai-images',
      operations: ['generate', 'edit'],
      limits: { maxCount: 4 },
    });
  });

  it('never throws on garbage — metadata is untyped JSON from the DB', () => {
    expect(readImageModelMetadata(null)).toEqual({});
    expect(readImageModelMetadata(undefined)).toEqual({});
    expect(readImageModelMetadata('not an object')).toEqual({});
    expect(readImageModelMetadata([1, 2, 3])).toEqual({});
    expect(readImageModelMetadata({ operations: 'generate' })).toEqual({});
    expect(readImageModelMetadata({ limits: 'nope' })).toEqual({});
  });

  it('drops unknown operations rather than trusting the blob', () => {
    // 运营在后台手填的 JSON 不可信：只认白名单里的两个操作。
    expect(readImageModelMetadata({ operations: ['generate', 'teleport'] })).toEqual({
      operations: ['generate'],
    });
    expect(readImageModelMetadata({ operations: ['teleport'] })).toEqual({ operations: [] });
  });

  it('rejects a non-positive or non-integer maxCount', () => {
    expect(readImageModelMetadata({ limits: { maxCount: 0 } })).toEqual({ limits: {} });
    expect(readImageModelMetadata({ limits: { maxCount: -1 } })).toEqual({ limits: {} });
    expect(readImageModelMetadata({ limits: { maxCount: 1.5 } })).toEqual({ limits: {} });
    expect(readImageModelMetadata({ limits: { maxCount: '4' } })).toEqual({ limits: {} });
  });
});

describe('supportsImageOperation', () => {
  it('is true only when the op is declared', () => {
    const meta = { operations: ['generate'] };
    expect(supportsImageOperation(meta, 'generate')).toBe(true);
    expect(supportsImageOperation(meta, 'edit')).toBe(false);
  });

  it('is false when operations is absent — absence is not permission', () => {
    // 能力必须显式声明。缺省成「什么都支持」会让一个没配 operations 的模型
    // 被当成支持 edit，而 preset 可能根本没实现 edit 端点。
    expect(supportsImageOperation({}, 'generate')).toBe(false);
    expect(supportsImageOperation(null, 'edit')).toBe(false);
  });
});

describe('readImageMaxCount', () => {
  it('returns the configured cap, or undefined when unset', () => {
    expect(readImageMaxCount({ limits: { maxCount: 4 } })).toBe(4);
    expect(readImageMaxCount({ limits: {} })).toBeUndefined();
    expect(readImageMaxCount(null)).toBeUndefined();
  });
});
