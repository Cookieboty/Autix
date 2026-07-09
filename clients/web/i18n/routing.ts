import { defineRouting } from 'next-intl/routing';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';

export const routing = defineRouting({
  locales: SUPPORTED_LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: 'as-needed',
  localeDetection: false,
  alternateLinks: false,
});

/** 会出现在 URL 里的 locale（默认语言走裸路径，不在此列）。 */
export const PREFIXED_LOCALES: readonly SupportedLanguage[] = SUPPORTED_LANGUAGES.filter(
  (l) => l !== DEFAULT_LANGUAGE,
);
