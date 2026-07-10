import { describe, it, expect } from 'vitest';
import { docLocalesWithUIStrings, getDocsConfig } from '@/lib/docs';
import { getPolicy } from '@/lib/i18n/route-policy';

// Finding 7: 每个声明的 doc locale 都必须有 UI 文案。主保证是编译期的
// `Record<DocLocale, ...>`（typecheck 兜底）；此处再加一层运行时回归守卫，防止
// ROUTE_POLICY['/docs'].locales 与 UI_STRINGS 漂移导致静默兜底。
describe('docs UI 文案与声明的 doc locale 保持耦合', () => {
  it('ROUTE_POLICY[/docs] 声明的每个 locale 都有 UI 文案', () => {
    const policy = getPolicy('/docs');
    expect(policy.kind).toBe('partial');
    const declared = policy.kind === 'partial' ? policy.locales : [];
    const withUI = docLocalesWithUIStrings();
    for (const locale of declared) {
      expect(withUI).toContain(locale);
    }
  });

  it('每个声明的 doc locale 解析到自身文案而非兜底', () => {
    expect(getDocsConfig('en').ui.backToHome).toBe('Back to Home');
    expect(getDocsConfig('zh-CN').ui.backToHome).toBe('返回首页');
  });
});
