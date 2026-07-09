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

  it('source 中每个动态段参数（:name 或 :name*）都在 destination 中原样保留', () => {
    // 从规则表派生断言，而非硬编码单个示例——这样新增规则会自动被覆盖。
    // 反例：`/system/membership/:path*` 若被误写成 `/admin/membership`
    // （丢了 `:path*`），会让 `/ja/system/membership/orders/5` 之类的深链接
    // 静默重定向到 `/ja/admin/membership`，然后 404。
    const paramPattern = /:[A-Za-z0-9_]+\*?/g;
    for (const rule of rules) {
      const sourceParams = rule.source.match(paramPattern) ?? [];
      for (const param of sourceParams) {
        expect(rule.destination, `${rule.source} -> ${rule.destination} 缺少参数 ${param}`).toContain(
          param,
        );
      }
    }
  });
});
