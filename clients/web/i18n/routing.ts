import { defineRouting } from 'next-intl/routing';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';

export const routing = defineRouting({
  locales: SUPPORTED_LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: 'as-needed',
  localeDetection: false,
  alternateLinks: false,
  // next-intl 默认会在每个响应上把协商出的 locale 写进 NEXT_LOCALE。那会把「用户从未
  // 选过语言」伪造成「用户选了英文」——首访裸路径立刻得到 NEXT_LOCALE=en，于是
  // 代理的 cookie 兜底和 resolveLanguage 的优先级链都被这个假信号压死，
  // localStorage 里真实的中文偏好永远赢不了。
  // 关掉它：NEXT_LOCALE 只由语言切换器和代理的显式英文出口写入，语义收敛为
  // 「用户的显式选择」，这是整条粘性链路成立的前提。
  localeCookie: false,
});

/** 会出现在 URL 里的 locale（默认语言走裸路径，不在此列）。 */
export const PREFIXED_LOCALES: readonly SupportedLanguage[] = SUPPORTED_LANGUAGES.filter(
  (l) => l !== DEFAULT_LANGUAGE,
);
