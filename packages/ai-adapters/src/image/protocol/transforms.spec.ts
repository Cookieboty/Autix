import { describe, it, expect } from 'vitest';
import { TRANSFORMS } from './transforms';

describe('TRANSFORMS.stripTierSuffix', () => {
  const strip = TRANSFORMS.stripTierSuffix;

  it('strips the @tier suffix', () => {
    expect(strip('2048x2048@2K')).toBe('2048x2048');
    expect(strip('1024x1024@1K')).toBe('1024x1024');
    expect(strip('256x1024@512px')).toBe('256x1024');
  });

  it('leaves a bare WxH token untouched', () => {
    expect(strip('1024x1024')).toBe('1024x1024');
  });

  it('passes non-string values through unchanged', () => {
    expect(strip(7)).toBe(7);
    expect(strip(undefined)).toBeUndefined();
  });
});
