import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  assertAligned,
  assertApiCatalogNonEmpty,
  assertPlaceholdersMatch,
  assertUntranslatedRatchet,
  collectIssues,
  countUntranslated,
  extractIcuArgs,
  extractMustacheArgs,
  loadApiLocales,
} from '../../check-i18n-consistency';

describe('assertAligned', () => {
  it('passes when all langs share identical leaf keys', () => {
    expect(assertAligned({ a: { x: '1' }, b: { x: '2' } })).toEqual([]);
  });
  it('reports a lang missing a key', () => {
    const issues = assertAligned({ a: { x: '1', y: '1' }, b: { x: '2' } });
    expect(issues.join(' ')).toContain('y');
  });
});

describe('extractMustacheArgs', () => {
  it('extracts the API `{{name}}` interpolation form', () => {
    expect(extractMustacheArgs('Missing field: {{field}}')).toEqual(['field']);
  });
  it('returns every occurrence so a duplicated arg is not silently collapsed', () => {
    expect(extractMustacheArgs('{{a}} then {{b}} then {{a}}')).toEqual(['a', 'a', 'b']);
  });
  it('ignores next-intl single-brace syntax, which the API never uses', () => {
    expect(extractMustacheArgs('Missing field: {field}')).toEqual([]);
  });
});

describe('extractIcuArgs', () => {
  it('extracts a simple next-intl `{name}` argument', () => {
    expect(extractIcuArgs('{menuCount} menus')).toEqual(['menuCount']);
  });
  it('extracts the argument name from a plural/select block, not its inner cases', () => {
    // `one`/`other` are ICU keywords, not arguments — counting them as args
    // would make every correct plural translation look mismatched.
    expect(extractIcuArgs('{count, plural, one {# item} other {# items}}')).toEqual(['count']);
  });
  it('ignores braces inside ICU single-quote escapes, which are literal text', () => {
    // `'{varName}'` renders the literal characters `{varName}` to the user — it is
    // documentation of the placeholder syntax, not a placeholder. Translators
    // legitimately localize it (`{变量名}`, `{nomVariable}`), so treating it as an
    // argument makes every correct translation of these keys look broken.
    expect(extractIcuArgs("Use '{varName}' placeholders")).toEqual([]);
    expect(extractIcuArgs("使用 '{变量名}' 占位符")).toEqual([]);
  });

  it('still extracts real arguments alongside an escaped literal', () => {
    expect(extractIcuArgs("Use '{varName}' — {count} left")).toEqual(['count']);
  });

  it('extracts multiple distinct arguments in sorted order', () => {
    expect(extractIcuArgs('{menuCount} menus · {permCount} permissions')).toEqual([
      'menuCount',
      'permCount',
    ]);
  });
});

describe('assertPlaceholdersMatch', () => {
  const base = 'en';

  it('passes when a translation carries every placeholder the base has', () => {
    const issues = assertPlaceholdersMatch(
      { en: { greet: 'Hello {{name}}' }, fr: { greet: 'Bonjour {{name}}' } },
      base,
      extractMustacheArgs,
    );
    expect(issues).toEqual([]);
  });

  it('passes when the translation reorders placeholders for its own grammar', () => {
    const issues = assertPlaceholdersMatch(
      { en: { m: '{{a}} before {{b}}' }, ja: { m: '{{b}} の前に {{a}}' } },
      base,
      extractMustacheArgs,
    );
    expect(issues).toEqual([]);
  });

  it('reports a placeholder dropped by the translation', () => {
    const issues = assertPlaceholdersMatch(
      {
        en: { m: '{menuCount} menus · {permCount} permissions' },
        fr: { m: '{menuCount} menus' },
      },
      base,
      extractIcuArgs,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('fr');
    expect(issues[0]).toContain('m');
    expect(issues[0]).toContain('permCount');
  });

  it('reports a placeholder the translation invented', () => {
    const issues = assertPlaceholdersMatch(
      { en: { m: 'Hello {{name}}' }, ru: { m: 'Привет {{name}}, {{extra}}' } },
      base,
      extractMustacheArgs,
    );
    expect(issues.join(' ')).toContain('extra');
  });

  it('reports a mistyped placeholder as both a loss and an addition', () => {
    // The failure this exists to catch: `{{levelName}}` mistyped as
    // `{{levelname}}` renders the literal braces to the user.
    const issues = assertPlaceholdersMatch(
      { en: { m: '{{levelName}}' }, vi: { m: '{{levelname}}' } },
      base,
      extractMustacheArgs,
    );
    expect(issues.join(' ')).toContain('levelName');
    expect(issues.join(' ')).toContain('levelname');
  });

  it('skips keys where a locale-specific argument is intentional', () => {
    // zh uses `{zhe}` (折, tenths-off) where en uses `{percent}` — 8折 is 20% off,
    // so it is a different number, not a renamed variable. The caller supplies both
    // (see `buildDiscountTranslationValues()`), so both renders are correct.
    const issues = assertPlaceholdersMatch(
      { en: { badge: '{percent}% OFF' }, 'zh-CN': { badge: '{zhe} 折优惠' } },
      base,
      extractIcuArgs,
      new Set(['badge']),
    );
    expect(issues).toEqual([]);
  });

  it('still flags a non-exempt key when an exemption list is supplied', () => {
    const issues = assertPlaceholdersMatch(
      { en: { other: '{a}' }, fr: { other: 'rien' } },
      base,
      extractIcuArgs,
      new Set(['badge']),
    );
    expect(issues).toHaveLength(1);
  });

  it('does not flag the base language against itself', () => {
    expect(assertPlaceholdersMatch({ en: { m: '{{a}}' } }, base, extractMustacheArgs)).toEqual([]);
  });
});

describe('countUntranslated', () => {
  it('counts values byte-identical to the base language', () => {
    const counts = countUntranslated(
      {
        en: { a: 'Success', b: 'Failed' },
        fr: { a: 'Succès', b: 'Failed' },
      },
      'en',
    );
    expect(counts.fr).toBe(1);
  });

  it('excludes the base language from the report', () => {
    const counts = countUntranslated({ en: { a: 'x' }, fr: { a: 'y' } }, 'en');
    expect(counts).not.toHaveProperty('en');
  });

  it('counts a wholesale English stub as fully untranslated', () => {
    // The failure this exists to catch: ja/fr/ru/vi.yaml shipped as
    // byte-for-byte copies of en.yaml and went unnoticed for months.
    const counts = countUntranslated({ en: { a: 'x', b: 'y' }, ja: { a: 'x', b: 'y' } }, 'en');
    expect(counts.ja).toBe(2);
  });
});

describe('assertApiCatalogNonEmpty', () => {
  it('词条表为空时失败——空目录不能算通过', () => {
    const issues = assertApiCatalogNonEmpty({ en: {}, fr: {} });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join(' ')).toContain('en');
  });

  it('某一语言为空时失败', () => {
    const issues = assertApiCatalogNonEmpty({ en: { 'a.b': 'x' }, fr: {} });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('fr');
  });

  it('各语言都有词条时通过', () => {
    expect(assertApiCatalogNonEmpty({ en: { 'a.b': 'x' }, fr: { 'a.b': 'y' } })).toEqual([]);
  });
});

describe('assertUntranslatedRatchet', () => {
  it('passes when a language sits exactly at its baseline', () => {
    expect(assertUntranslatedRatchet({ fr: 778 }, { fr: 778 })).toEqual([]);
  });

  it('fails when untranslated keys grow past the baseline', () => {
    const issues = assertUntranslatedRatchet({ fr: 781 }, { fr: 778 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('fr');
    expect(issues[0]).toContain('781');
    expect(issues[0]).toContain('778');
  });

  it('demands the baseline be lowered when translations improve, so it ratchets', () => {
    // Without this the baseline only ever drifts upward and stops meaning anything.
    const issues = assertUntranslatedRatchet({ ru: 700 }, { ru: 719 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('700');
  });

  it('treats a language absent from the baseline as needing zero untranslated', () => {
    expect(assertUntranslatedRatchet({ de: 5 }, {})).toHaveLength(1);
    expect(assertUntranslatedRatchet({ de: 0 }, {})).toEqual([]);
  });
});

describe('collectIssues (main() wiring)', () => {
  // Regression test for a reviewer deleting the single line that wires
  // `assertApiCatalogNonEmpty` into `main()`: every unit test for the pure
  // function kept passing, and `pnpm run i18n:check` stayed green even with
  // the entire locales directory moved away, because nothing exercised the
  // wiring itself. Inject an empty API catalog so we don't have to mutate
  // the real repo's locales directory to prove the wiring works.
  it('surfaces a catalog: issue when the injected API catalog is empty', () => {
    const emptyApiByLang = Object.fromEntries(
      ['zh-CN', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'].map((l) => [l, {}]),
    );
    const issues = collectIssues(emptyApiByLang);
    expect(issues.some((i) => i.includes('catalog:'))).toBe(true);
  });
});

describe('loadApiLocales', () => {
  // Regression test mirroring `locale-loader.ts`'s own duplicate-key guard
  // (hardened in 8f25ba82): `loadApiLocales` used to reimplement the same
  // recursive walk-and-merge by hand, without that guard, so a key defined
  // with different values in two domain files for the same language was
  // silently resolved last-write-wins instead of failing loudly.
  it('throws when the same key is defined in two different domain files for one language', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-locales-dup-'));
    try {
      mkdirSync(join(dir, 'billing'));
      mkdirSync(join(dir, 'creation'));
      writeFileSync(join(dir, 'billing', 'en.yaml'), 'shared.key: from-billing\n');
      writeFileSync(join(dir, 'creation', 'en.yaml'), 'shared.key: from-creation\n');
      expect(() => loadApiLocales(dir)).toThrow(/shared\.key/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
