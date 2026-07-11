import type { useTranslations } from 'next-intl';

type Translator = ReturnType<typeof useTranslations>;

/**
 * Resolves a schema-provided `x-ui.labelKey`/`optionLabelKeys[...]` entry (e.g.
 * `pricing.params.duration`) against a namespaced `useTranslations(...)` instance, falling back
 * to `fallback` whenever the translation genuinely isn't available — not just when `key` itself is
 * `undefined` (spec §6.9 fallback contract).
 *
 * Before this helper, callers did `key ? t(key.replace(prefix, '')) : fallback`: if `key` was
 * *present* but missing from the message catalog (a typo'd labelKey, an admin-authored schema
 * referencing a key that was never added to messages/*.json, etc.), `next-intl` doesn't throw —
 * it returns the dotted key path itself, e.g. `"pricing.params.duration"` — so the UI silently
 * showed a translation-catalog key to the user instead of falling back to the readable default
 * (the raw param name / enum value) the caller passed in.
 *
 * `t.has(key)` (added in next-intl/use-intl's `createTranslator`) is the documented way to check
 * catalog membership without throwing or relying on string-shape heuristics, so this prefers it;
 * environments where `has` isn't available fall back to a try/catch around the lookup.
 */
export function translateSchemaKey(
  t: Translator,
  prefix: string,
  key: string | undefined,
  fallback: string,
): string {
  if (!key) return fallback;
  const shortKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;

  const hasFn = (t as unknown as { has?: (k: string) => boolean }).has;
  if (typeof hasFn === 'function') {
    return hasFn(shortKey) ? t(shortKey) : fallback;
  }

  try {
    const translated = t(shortKey);
    // Belt-and-braces for translator implementations without `.has`: next-intl's default
    // "MISSING_MESSAGE" behavior returns the key path itself rather than throwing.
    return translated === shortKey || translated === key ? fallback : translated;
  } catch {
    return fallback;
  }
}
