import { describe, it, expect } from 'vitest';
import { matchRoutePolicy } from '@/lib/i18n/match-route-policy';

describe('matchRoutePolicy', () => {
  it('/docs → partial（en + zh-CN）', () => {
    const policy = matchRoutePolicy('/docs');
    expect(policy?.kind).toBe('partial');
    expect(policy?.kind === 'partial' && policy.locales).toEqual(['en', 'zh-CN']);
  });

  it('/docs/guides/x → partial（catch-all 匹配一段或多段）', () => {
    const policy = matchRoutePolicy('/docs/guides/x');
    expect(policy?.kind).toBe('partial');
  });

  it('/marketplace/image-templates/abc → neutral（两个单动态段）', () => {
    expect(matchRoutePolicy('/marketplace/image-templates/abc')?.kind).toBe('neutral');
  });

  it('/marketplace/image-templates → neutral（/marketplace/[type]）', () => {
    expect(matchRoutePolicy('/marketplace/image-templates')?.kind).toBe('neutral');
  });

  it('/u/alice → neutral', () => {
    expect(matchRoutePolicy('/u/alice')?.kind).toBe('neutral');
  });

  it('/pricing → full', () => {
    expect(matchRoutePolicy('/pricing')?.kind).toBe('full');
  });

  it('/ → full（根路径）', () => {
    expect(matchRoutePolicy('/')?.kind).toBe('full');
  });

  it('未知路径 → null（不瞎猜）', () => {
    expect(matchRoutePolicy('/totally/unknown/path')).toBeNull();
    expect(matchRoutePolicy('/nope')).toBeNull();
  });

  it('catch-all 不匹配零段：/docs 命中 /docs 而非 /docs/[...slug]', () => {
    // /docs 段数=1，/docs/[...slug] 需要 catch-all 至少吃一段 → 不命中，故落到精确的 /docs
    const policy = matchRoutePolicy('/docs');
    expect(policy?.kind).toBe('partial');
  });
});
