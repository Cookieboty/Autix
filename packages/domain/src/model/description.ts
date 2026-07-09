/** 与 packages/i18n/src/messages/*.json 一一对应。新增 locale 时两处同步。 */
export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'fr', 'ru', 'vi'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type LocalizedText = Partial<Record<Locale, string>>;

const DEFAULT_LOCALE: Locale = 'en';

function isSupported(locale: string): locale is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * 解析顺序：请求 locale → en → 模型名。
 * 空字符串视为缺失——运营新建模型时常常留下空的 zh-CN。
 */
export function resolveDescription(
  description: LocalizedText,
  locale: string,
  fallbackName: string,
): string {
  if (isSupported(locale) && description[locale]) return description[locale] as string;
  if (description[DEFAULT_LOCALE]) return description[DEFAULT_LOCALE] as string;
  return fallbackName;
}

/**
 * 返回违规的键。空数组表示合法。
 *
 * 校验 locale 键是必需的：写成 `cn` 或 `zh` 不会报错，只会让前端永远
 * 取不到中文描述，静默回退到 en。这类错误在 UI 上看起来像"忘了填"。
 */
export function validateDescription(description: unknown): string[] {
  if (typeof description !== 'object' || description === null || Array.isArray(description)) {
    return ['<root>'];
  }

  return Object.entries(description as Record<string, unknown>)
    .filter(([locale, text]) => !isSupported(locale) || typeof text !== 'string')
    .map(([locale]) => locale);
}
