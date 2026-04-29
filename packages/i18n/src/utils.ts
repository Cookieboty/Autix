import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from './constants';

/**
 * Normalize a raw language tag (e.g. from Accept-Language) into one of the
 * supported language codes.  Returns `null` when the tag cannot be mapped.
 */
export function normalizeLang(lang: string): SupportedLanguage | null {
  const lower = lang.toLowerCase().trim().replace(/_/g, '-');

  if (
    lower === 'zh-tw' ||
    lower === 'zh-hk' ||
    lower === 'zh-mo' ||
    lower.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }

  if (lower.startsWith('zh')) {
    return 'zh-CN';
  }

  const match = SUPPORTED_LANGUAGES.find((l) =>
    lower.startsWith(l.toLowerCase()),
  );
  return match ?? null;
}

export function isSupportedLang(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * Parse the first language from an Accept-Language header value and normalize it.
 */
export function parseAcceptLanguage(header: string): SupportedLanguage {
  if (!header) return DEFAULT_LANGUAGE;

  const first = header.split(',')[0]?.trim();
  if (!first) return DEFAULT_LANGUAGE;

  const tag = first.includes(';') ? first.slice(0, first.indexOf(';')) : first;
  return normalizeLang(tag.trim()) ?? DEFAULT_LANGUAGE;
}
