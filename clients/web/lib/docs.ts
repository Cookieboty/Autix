import { getPolicy, DOC_LOCALES } from './i18n/route-policy';
import enDocsConfig from '../../../packages/i18n/src/messages/docs-layout.en.json';
import zhCNDocsConfig from '../../../packages/i18n/src/messages/docs-layout.zh-CN.json';

/** doc locale 的字面量联合类型，直接来自 route-policy 的唯一真源。 */
type DocLocale = (typeof DOC_LOCALES)[number];

export const DOC_SLUGS = [
  'workflow',
  'templates',
  'pricing',
  'gallery',
  'faq',
  'changelog',
] as const;

/** `/docs` 的可用 locale 唯一由 `ROUTE_POLICY` 定义，不再维护并行列表。 */
export function isValidDocLocale(locale: string): boolean {
  const policy = getPolicy('/docs');
  return policy.kind === 'partial' && (policy.locales as string[]).includes(locale);
}

// --- Navigation config per locale ---

interface NavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

interface DocsUIStrings {
  siteTitle: string;
  backToHome: string;
  lightMode: string;
  darkMode: string;
}

interface DocsLocaleConfig {
  nav: NavItem[];
  ui: DocsUIStrings;
}

// 键类型为 `DocLocale`：ROUTE_POLICY['/docs'].locales 若新增 locale（经 DOC_LOCALES），
// 这里缺对应文案会编译报错，而不再是 `isValidDocLocale` 放行、`UI_STRINGS[locale]` 却
// undefined 的静默兜底。
const DOCS_CONFIGS: Record<DocLocale, DocsLocaleConfig> = {
  'zh-CN': zhCNDocsConfig,
  en: enDocsConfig,
};

/** 每个声明的 doc locale 都有 UI 文案（编译期由 `Record<DocLocale>` 保证）。测试用。 */
export function docLocalesWithUIStrings(): string[] {
  return Object.keys(DOCS_CONFIGS);
}

export function getDocsConfig(locale: string): DocsLocaleConfig {
  const safeLocale: DocLocale = isValidDocLocale(locale)
    ? (locale as DocLocale)
    : locale.toLowerCase().startsWith('zh')
      ? 'zh-CN'
      : 'en';
  return DOCS_CONFIGS[safeLocale];
}
