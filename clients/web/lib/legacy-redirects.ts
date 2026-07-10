import { PREFIXED_LOCALES } from '../i18n/routing';

type Redirect = { source: string; destination: string; permanent: true };

const LEGACY_REDIRECTS: Omit<Redirect, 'permanent'>[] = [
  { source: '/system', destination: '/admin' },
  { source: '/system/templates', destination: '/admin/templates' },
  { source: '/system/membership/:path*', destination: '/admin/membership/:path*' },
  { source: '/permission-center', destination: '/admin/permission-center' },
  { source: '/templates/mine', destination: '/profile?tab=published' },
  { source: '/templates/submit', destination: '/marketplace/image-templates' },
  { source: '/marketplace/image-templates/new', destination: '/marketplace/image-templates' },
  { source: '/templates/workspace/:id', destination: '/marketplace/image-templates/:id' },
  { source: '/templates/:id', destination: '/marketplace/image-templates/:id' },
  { source: '/templates', destination: '/marketplace/image-templates' },
];

/**
 * next.config 的 redirects 是字面量匹配：`source: '/system'` 匹配不到 `/ja/system`。
 * 全站 [locale] 化后必须为每个前缀 locale 派生变体，否则这批规则集体静默失效。
 */
export function buildLegacyRedirects(): Redirect[] {
  return LEGACY_REDIRECTS.flatMap((r) => [
    { ...r, permanent: true as const },
    ...PREFIXED_LOCALES.map((locale) => ({
      source: `/${locale}${r.source}`,
      destination: `/${locale}${r.destination}`,
      permanent: true as const,
    })),
  ]);
}
