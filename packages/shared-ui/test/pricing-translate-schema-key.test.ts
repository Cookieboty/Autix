import { describe, expect, test } from 'bun:test';
import { translateSchemaKey } from '../src/pricing/translate-schema-key';

/** Minimal next-intl-shaped translator stub: callable + `.has`, matching `createTranslator`'s
 * documented shape (`(key: string) => string` with a `has(key): boolean` method). */
function makeTranslator(catalog: Record<string, string>) {
  const t = ((key: string) => catalog[key] ?? key) as unknown as {
    (key: string): string;
    has: (key: string) => boolean;
  };
  t.has = (key: string) => key in catalog;
  return t;
}

describe('translateSchemaKey', () => {
  test('falls back when key is undefined', () => {
    const t = makeTranslator({ duration: 'Duration' });
    expect(translateSchemaKey(t, 'pricing.params.', undefined, 'fallback')).toBe('fallback');
  });

  test('translates a present, existing key (strips the prefix)', () => {
    const t = makeTranslator({ duration: 'Duration' });
    expect(translateSchemaKey(t, 'pricing.params.', 'pricing.params.duration', 'fallback')).toBe('Duration');
  });

  test('falls back when key is present but missing from the catalog (not just when key is undefined)', () => {
    const t = makeTranslator({ duration: 'Duration' });
    expect(translateSchemaKey(t, 'pricing.params.', 'pricing.params.typoKey', 'fallback')).toBe('fallback');
  });

  test('falls back via the has()-less try/catch path when the translator has no has()', () => {
    const catalog: Record<string, string> = { duration: 'Duration' };
    const t = ((key: string) => catalog[key] ?? key) as unknown as (key: string) => string;
    expect(translateSchemaKey(t as any, 'pricing.params.', 'pricing.params.duration', 'fallback')).toBe('Duration');
    expect(translateSchemaKey(t as any, 'pricing.params.', 'pricing.params.missing', 'fallback')).toBe('fallback');
  });
});
