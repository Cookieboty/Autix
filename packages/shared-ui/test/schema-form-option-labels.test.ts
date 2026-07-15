import { resolveOptionLabel } from '../src/pricing/SchemaForm/schema-form-logic';
import type { XUi } from '@autix/domain/pricing';

const t = (key: string | undefined, fallback: string) => (key === 'pricing.options.high' ? '高清' : fallback);

describe('resolveOptionLabel — 优先级 optionLabelKeys > optionLabels > 原始值（types.ts:38）', () => {
  test('prefers the i18n key when both are present', () => {
    const ui: XUi = {
      control: 'chips',
      optionLabelKeys: { high: 'pricing.options.high' },
      optionLabels: { high: 'HD' },
    };
    expect(resolveOptionLabel(ui, 'high', t)).toBe('高清');
  });

  test('falls back to the literal optionLabels when no i18n key exists', () => {
    const ui: XUi = { control: 'size-grid', optionLabels: { '1024x1024@1K': '1:1' } };
    expect(resolveOptionLabel(ui, '1024x1024@1K', t)).toBe('1:1');
  });

  test('falls back to the raw value when neither exists', () => {
    expect(resolveOptionLabel({ control: 'chips' }, 'weird', t)).toBe('weird');
  });

  // 变异测试：'1:1' / '2K' 是语言无关标记，**不得**被塞进 i18n
  test('does not route a literal optionLabel through the translator', () => {
    let calls = 0;
    const spy = (key: string | undefined, fallback: string) => {
      calls += 1;
      return t(key, fallback);
    };
    resolveOptionLabel({ control: 'size-grid', optionLabels: { a: '1:1' } }, 'a', spy);
    expect(calls).toBe(0);
  });
});
