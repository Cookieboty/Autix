export const DOC_LOCALES = ['zh-CN', 'en'] as const;
export type DocLocale = (typeof DOC_LOCALES)[number];
export const DEFAULT_DOC_LOCALE: DocLocale = 'zh-CN';

export const DOC_SLUGS = [
  'workflow',
  'templates',
  'pricing',
  'gallery',
  'faq',
  'changelog',
] as const;

export function isValidDocLocale(locale: string): locale is DocLocale {
  return (DOC_LOCALES as readonly string[]).includes(locale);
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

function buildNav(locale: string): NavItem[] {
  const base = `/${locale}/docs`;
  if (locale === 'zh-CN') {
    return [
      { label: '快速开始', href: base },
      {
        label: '平台指南',
        children: [
          { label: '工作流概述', href: `${base}/workflow` },
          { label: '模板系统', href: `${base}/templates` },
          { label: '积分与套餐', href: `${base}/pricing` },
          { label: '作品管理', href: `${base}/gallery` },
        ],
      },
      { label: '常见问题', href: `${base}/faq` },
      { label: '更新日志', href: `${base}/changelog` },
    ];
  }
  return [
    { label: 'Getting Started', href: base },
    {
      label: 'Platform Guide',
      children: [
        { label: 'Workflow Overview', href: `${base}/workflow` },
        { label: 'Template System', href: `${base}/templates` },
        { label: 'Credits & Plans', href: `${base}/pricing` },
        { label: 'Asset Management', href: `${base}/gallery` },
      ],
    },
    { label: 'FAQ', href: `${base}/faq` },
    { label: 'Changelog', href: `${base}/changelog` },
  ];
}

const UI_STRINGS: Record<DocLocale, DocsUIStrings> = {
  'zh-CN': {
    siteTitle: 'Amux Studio Docs',
    backToHome: '返回首页',
    lightMode: '浅色模式',
    darkMode: '深色模式',
  },
  en: {
    siteTitle: 'Amux Studio Docs',
    backToHome: 'Back to Home',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
  },
};

export function getDocsConfig(locale: string): DocsLocaleConfig {
  const safeLocale: DocLocale = isValidDocLocale(locale) ? locale : DEFAULT_DOC_LOCALE;
  return {
    nav: buildNav(safeLocale),
    ui: UI_STRINGS[safeLocale],
  };
}
