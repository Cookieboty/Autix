import type { MetadataRoute } from 'next';
import { PREFIXED_LOCALES } from '@/i18n/routing';
import { resolveSiteUrl } from '@/lib/i18n/site-url';

/**
 * Real URL segments of the authed area. Route-group parentheses — `(app)`,
 * `(admin)` — are a Next.js filesystem convention and never appear in the
 * URL, so they must not appear here either.
 */
const AUTHED_SEGMENTS = [
  'arena',
  'c',
  'chat',
  'draw',
  'library',
  'materials',
  'membership',
  'notifications',
  'profile',
  'resources',
  'workbench',
  'admin',
] as const;

/** Private share links (fixes pre-existing index leakage, see spec §5.1.1). */
const PRIVATE_SHARE_SEGMENTS = ['share', 's'] as const;

export default function robots(): MetadataRoute.Robots {
  const segments = [...AUTHED_SEGMENTS, ...PRIVATE_SHARE_SEGMENTS];

  // Bare path + all 6 locale-prefixed variants, cross-producted so
  // `/ja/chat` etc. are blocked too — generated, not hand-written.
  const disallow = segments.flatMap((segment) => [
    `/${segment}/`,
    ...PREFIXED_LOCALES.map((locale) => `/${locale}/${segment}/`),
  ]);

  // Read at call time (see `app/sitemap.ts` for why: `resolveSiteUrl()`
  // re-reads the env var per call instead of freezing it at module load).
  const siteUrl = resolveSiteUrl();

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  };
}
