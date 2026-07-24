import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';

export interface LanguageSources {
  /** 当前 URL 激活的 locale。web 恒有值（每个页面都在 [locale] 下）；desktop 无。 */
  urlLocale?: string;
  /** NEXT_LOCALE cookie。代理据此决策，也由代理写入。 */
  cookie?: string;
  /** localStorage 持久化值。只由 setLanguage 写入，作为"用户手动设置过"的标记。 */
  stored?: string;
  /** 运行环境语言（web: navigator.language(s)；desktop: app.getLocale()）。cookie 与 stored 均缺失时的兜底。 */
  environment?: string;
}

export interface LanguageResolution {
  language: SupportedLanguage;
  /** 需要写回 cookie（仅当当前 cookie 与结论不一致时给出）。 */
  writeCookie?: SupportedLanguage;
  /** 需要写回 localStorage（仅当当前值与结论不一致时给出）。 */
  writeStored?: SupportedLanguage;
  /** 需要把 URL 切到该语言。只在「代理当时无 cookie 可依据」时给出，见下。 */
  switchUrlTo?: SupportedLanguage;
}

function valid(value?: string): SupportedLanguage | undefined {
  return value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    ? (value as SupportedLanguage)
    : undefined;
}

/**
 * 优先级 **URL > cookie > stored > environment > DEFAULT_LANGUAGE**。
 * 不变量：stored 只表示"用户手动设置过"，resolveLanguage 只做错位纠错，不主动写入 stored。
 * switchUrlTo 仅在 URL 为裸路径且无 cookie 时给出（locale 中立端点由代理刻意放行）。
 */
export function resolveLanguage(sources: LanguageSources): LanguageResolution {
  const urlLocale = valid(sources.urlLocale);
  const cookie = valid(sources.cookie);
  const stored = valid(sources.stored);
  const environment = valid(sources.environment);

  let language: SupportedLanguage;
  let switchUrlTo: SupportedLanguage | undefined;

  if (urlLocale !== undefined && urlLocale !== DEFAULT_LANGUAGE) {
    language = urlLocale;
  } else if (cookie !== undefined) {
    language = cookie;
  } else if (stored !== undefined) {
    language = stored;
    if (urlLocale !== undefined && language !== DEFAULT_LANGUAGE) {
      switchUrlTo = language;
    }
  } else if (environment !== undefined) {
    language = environment;
    if (urlLocale !== undefined && language !== DEFAULT_LANGUAGE) {
      switchUrlTo = language;
    }
  } else {
    language = DEFAULT_LANGUAGE;
  }

  // cookie: 错位或缺失时都回写；stored: 只在有值且错位时纠错，缺失一律不写。
  const needsWriteCookie = (current: SupportedLanguage | undefined) =>
    current !== undefined ? current !== language : language !== DEFAULT_LANGUAGE;
  const needsWriteStored = (current: SupportedLanguage | undefined) =>
    current !== undefined && current !== language;

  const result: LanguageResolution = { language };
  if (needsWriteCookie(cookie)) result.writeCookie = language;
  if (needsWriteStored(stored)) result.writeStored = language;
  if (switchUrlTo) result.switchUrlTo = switchUrlTo;
  return result;
}
