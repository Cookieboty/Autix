import { describe, it, expect } from 'vitest';
import { buildLegacyRedirects } from '@/lib/legacy-redirects';

describe('legacy redirects 的 locale 变体', () => {
  const rules = buildLegacyRedirects();

  it('裸路径规则保留', () => {
    expect(rules).toContainEqual({
      source: '/system',
      destination: '/admin',
      permanent: true,
    });
  });

  it('每条规则派生 6 个前缀变体', () => {
    expect(rules).toContainEqual({
      source: '/ja/system',
      destination: '/ja/admin',
      permanent: true,
    });
    expect(rules).toContainEqual({
      source: '/zh-CN/templates/:id',
      destination: '/zh-CN/marketplace/image-templates/:id',
      permanent: true,
    });
  });

  it('不为默认语言 en 生成前缀变体', () => {
    expect(rules.some((r) => r.source.startsWith('/en/'))).toBe(false);
  });

  it('规则总数 = 10 条原始 × (1 裸路径 + 6 前缀) = 70', () => {
    expect(rules).toHaveLength(70);
  });
});
