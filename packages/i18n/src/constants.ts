export const SUPPORTED_LANGUAGES = [
  'zh-CN',
  'zh-TW',
  'en',
  'fr',
  'ja',
  'ru',
  'vi',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

export const LANGUAGE_NAME_FIELDS: Record<SupportedLanguage, string> = {
  'zh-CN': 'name',
  'zh-TW': 'nameZhTW',
  en: 'nameEn',
  fr: 'nameFr',
  ja: 'nameJa',
  ru: 'nameRu',
  vi: 'nameVi',
};

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  fr: 'Français',
  ja: '日本語',
  ru: 'Русский',
  vi: 'Tiếng Việt',
};
