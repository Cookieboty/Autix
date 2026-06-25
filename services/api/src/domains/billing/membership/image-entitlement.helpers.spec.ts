import { ForbiddenException } from '@nestjs/common';
import {
  assertImageEntitlement,
  IMAGE_PIXELS_HARD_CEILING,
  parseImageSizePixels,
  resolveImageEntitlement,
  type ImageEntitlement,
} from './image-entitlement.helpers';

const now = new Date('2026-06-25T00:00:00.000Z');

describe('parseImageSizePixels', () => {
  it('parses WxH into a pixel count', () => {
    expect(parseImageSizePixels('1024x1024')).toBe(1024 * 1024);
    expect(parseImageSizePixels('1920X1080')).toBe(1920 * 1080);
    expect(parseImageSizePixels(' 512 x 512 ')).toBe(512 * 512);
  });

  it('returns 0 for unknown/empty sizes', () => {
    expect(parseImageSizePixels(undefined)).toBe(0);
    expect(parseImageSizePixels(null)).toBe(0);
    expect(parseImageSizePixels('auto')).toBe(0);
  });
});

describe('resolveImageEntitlement', () => {
  it('returns a permissive free default for non-active membership', () => {
    expect(resolveImageEntitlement(null, now)).toEqual(
      expect.objectContaining({
        enabled: true,
        maxPixels: IMAGE_PIXELS_HARD_CEILING,
        allowedQualities: [],
        source: 'free_default',
        level: 0,
      }),
    );
  });

  it('reads per-level features.image overrides for an active membership', () => {
    const membership = {
      status: 'ACTIVE',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      level: {
        level: 2,
        name: 'Creator',
        features: { image: { maxPixels: 1024 * 1024, allowedQualities: ['low', 'medium'], concurrency: 3 } },
      },
    };
    expect(resolveImageEntitlement(membership, now)).toEqual({
      enabled: true,
      maxPixels: 1024 * 1024,
      allowedQualities: ['low', 'medium'],
      concurrency: 3,
      levelName: 'Creator',
      level: 2,
      source: 'membership',
    });
  });

  it('defaults to permissive when an active level has no features.image', () => {
    const membership = {
      status: 'ACTIVE',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      level: { level: 1, name: 'Lite', features: {} },
    };
    expect(resolveImageEntitlement(membership, now)).toEqual(
      expect.objectContaining({ enabled: true, maxPixels: IMAGE_PIXELS_HARD_CEILING, allowedQualities: [] }),
    );
  });
});

describe('assertImageEntitlement', () => {
  const base: ImageEntitlement = {
    enabled: true,
    maxPixels: 1024 * 1024,
    allowedQualities: ['low', 'medium'],
    concurrency: 1,
    levelName: 'Creator',
    level: 2,
    source: 'membership',
  };

  it('passes when within resolution and quality limits', () => {
    expect(() => assertImageEntitlement(base, { size: '1024x1024', quality: 'medium' })).not.toThrow();
  });

  it('rejects when image generation is disabled for the level', () => {
    expect(() => assertImageEntitlement({ ...base, enabled: false }, { size: '512x512' })).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when the requested resolution exceeds the tier cap', () => {
    expect(() => assertImageEntitlement(base, { size: '2048x2048' })).toThrow(ForbiddenException);
  });

  it('rejects a quality not in the allowed list', () => {
    expect(() => assertImageEntitlement(base, { size: '1024x1024', quality: 'hd' })).toThrow(
      ForbiddenException,
    );
  });

  it('allows any quality when allowedQualities is empty', () => {
    expect(() =>
      assertImageEntitlement({ ...base, allowedQualities: [] }, { size: '1024x1024', quality: 'hd' }),
    ).not.toThrow();
  });
});
