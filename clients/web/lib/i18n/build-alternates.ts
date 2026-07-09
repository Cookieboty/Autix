import type { Metadata } from 'next';
import type { SupportedLanguage } from '@autix/i18n';
import { routing } from '@/i18n/routing';
import { resolveSiteUrl } from './site-url';
import { getPolicy, localizedPath } from './route-policy';

function absolute(path: string): string {
  // 每次调用都重新解析站点基址，而非依赖模块加载时冻结的 SITE_URL 常量——
  // 见 site-url.ts 中 resolveSiteUrl() 的注释。
  return new URL(path, resolveSiteUrl()).toString();
}

function fillParams(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  return template.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_, catchAll: string | undefined, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`buildAlternates: 模板 "${template}" 缺少参数 "${key}"`);
    }
    // catch-all（如 `[...slug]`）的值本身合法地包含 `/`：按 `/` 拆段、逐段转义、
    // 再拼回去，保留段结构。单段参数（`[id]`、`[token]` 等）整体转义，防止值里的
    // `/`、`?`、`#` 被解析成额外路径段 / 查询串 / fragment。
    if (catchAll) {
      return value.split('/').map(encodeURIComponent).join('/');
    }
    return encodeURIComponent(value);
  });
}

function languageMap(path: string, locales: readonly SupportedLanguage[]) {
  const langs: Record<string, string> = {};
  for (const locale of locales) {
    langs[locale] = absolute(localizedPath(path, locale));
  }
  langs['x-default'] = absolute(path);
  return langs;
}

export function buildAlternates(
  template: string,
  params?: Record<string, string>,
  locale?: SupportedLanguage,
): Pick<Metadata, 'alternates' | 'robots'> {
  const policy = getPolicy(template);
  const path = fillParams(template, params);
  const bareCanonical = absolute(path);
  // `full`/`partial` 自指向当前 locale：把裸路径恒指向默认语言会告诉 Google
  // 「非英文变体是英文页的重复内容」，Google 会把它们并入英文 canonical 并从
  // 索引中丢弃——恰好抵消这次迁移想建立的 hreflang 簇。`neutral`/`noindex`
  // 维持恒定裸路径：正文未翻译的变体本来就是近重复内容，理应收敛。
  const selfCanonical = absolute(localizedPath(path, locale ?? routing.defaultLocale));

  switch (policy.kind) {
    case 'full':
      return {
        alternates: { canonical: selfCanonical, languages: languageMap(path, routing.locales) },
      };
    case 'partial':
      return {
        alternates: { canonical: selfCanonical, languages: languageMap(path, policy.locales) },
      };
    case 'neutral':
      // 正文未翻译：所有 locale 变体收敛到裸路径，避免近重复内容判定
      return { alternates: { canonical: bareCanonical } };
    case 'noindex':
      return {
        alternates: { canonical: bareCanonical },
        robots: { index: false, follow: false },
      };
  }
}
