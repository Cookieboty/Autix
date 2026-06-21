import {
  createVideoShareCode,
  isVideoShareCode,
} from './video-share-token';

describe('video share code', () => {
  it('creates compact share codes', () => {
    const code = createVideoShareCode();

    expect(code).toHaveLength(8);
    expect(isVideoShareCode(code)).toBe(true);
  });

  it('validates short code shape', () => {
    expect(isVideoShareCode('abc123XY')).toBe(true);
    expect(isVideoShareCode('abc123')).toBe(false);
    expect(isVideoShareCode('abc123XY.unsafe')).toBe(false);
    expect(isVideoShareCode('abc123XY_')).toBe(false);
  });
});
