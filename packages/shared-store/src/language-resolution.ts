import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type SupportedLanguage } from '@autix/i18n';

export interface LanguageSources {
  /** 当前 URL 激活的 locale。web 恒有值（每个页面都在 [locale] 下）；desktop 无。 */
  urlLocale?: string;
  /** NEXT_LOCALE cookie。代理据此决策，也由代理写入。 */
  cookie?: string;
  /** localStorage 持久化值。desktop 唯一来源。 */
  stored?: string;
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
 * 把三个可能互相矛盾的语言来源收敛成唯一结论，并给出需要回写的目标。
 *
 * 优先级 **URL 前缀 > cookie > localStorage**：
 * - URL 最显式：用户点了本地化链接，或代理刚刚基于 cookie 判定过。
 * - cookie 是服务端/代理唯一看得见的信号，绝不能被 localStorage 静默覆盖，
 *   否则两端永久失配（典型症状：`/en/*` 把 cookie 改成英文，hydrate 又被旧的
 *   localStorage 中文覆盖回去，页面英文而选择器中文）。
 * - localStorage 仅作最后兜底。
 *
 * `switchUrlTo` 只在「URL 是裸路径 **且** 没有 cookie」时给出。有 cookie 却仍停在
 * 裸路径，说明代理看过 cookie 后**刻意**没捞（locale 中立端点，如 /oauth/*），
 * 此时客户端不得擅自改 URL —— 否则会把 OAuth 回调这类机器端点也带上前缀。
 */
export function resolveLanguage(sources: LanguageSources): LanguageResolution {
  const urlLocale = valid(sources.urlLocale);
  const cookie = valid(sources.cookie);
  const stored = valid(sources.stored);

  let language: SupportedLanguage;
  let switchUrlTo: SupportedLanguage | undefined;

  if (urlLocale !== undefined && urlLocale !== DEFAULT_LANGUAGE) {
    language = urlLocale;
  } else if (cookie !== undefined) {
    language = cookie;
  } else if (stored !== undefined) {
    language = stored;
    // 代理当时无 cookie 可依据才放行了裸路径；客户端补上 cookie 后需把 URL 也切过去。
    // desktop 无 urlLocale，天然不产生切换。
    if (urlLocale !== undefined && language !== DEFAULT_LANGUAGE) {
      switchUrlTo = language;
    }
  } else {
    language = DEFAULT_LANGUAGE;
  }

  // 回写规则：只在「该来源存在且与结论不符」（必须纠正错位），或「该来源缺失且结论不是
  // 默认语言」（需要持久化用户的非默认选择）时写。首次访问且结论就是默认语言时不写，
  // 避免给每个新访客/爬虫平白种下 cookie。
  const needsWrite = (current: SupportedLanguage | undefined) =>
    current !== undefined ? current !== language : language !== DEFAULT_LANGUAGE;

  const result: LanguageResolution = { language };
  if (needsWrite(cookie)) result.writeCookie = language;
  if (needsWrite(stored)) result.writeStored = language;
  if (switchUrlTo) result.switchUrlTo = switchUrlTo;
  return result;
}
