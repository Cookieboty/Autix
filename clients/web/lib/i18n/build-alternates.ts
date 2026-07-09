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
  return template.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`buildAlternates: 模板 "${template}" 缺少参数 "${key}"`);
    }
    return value;
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
): Pick<Metadata, 'alternates' | 'robots'> {
  const policy = getPolicy(template);
  const path = fillParams(template, params);
  const canonical = absolute(path);

  switch (policy.kind) {
    case 'full':
      return { alternates: { canonical, languages: languageMap(path, routing.locales) } };
    case 'partial':
      return { alternates: { canonical, languages: languageMap(path, policy.locales) } };
    case 'neutral':
      // 正文未翻译：所有 locale 变体收敛到裸路径，避免近重复内容判定
      return { alternates: { canonical } };
    case 'noindex':
      return { alternates: { canonical }, robots: { index: false, follow: false } };
  }
}
