import type { MetadataRoute } from 'next';
import { PREFIXED_LOCALES } from '@/i18n/routing';
import { resolveSiteUrl } from '@/lib/i18n/site-url';

/**
 * Real URL segments of the authed area. Route-group parentheses — `(app)`,
 * `(admin)` — are a Next.js filesystem convention and never appear in the
 * URL, so they must not appear here either.
 */
const AUTHED_SEGMENTS = [
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

// NOTE: `/share/` and `/s/` are DELIBERATELY NOT disallowed here.
//
// These share pages carry `robots: { index: false, follow: false }` (a `noindex`
// meta tag, via route-policy.ts). `noindex` only works if Googlebot is allowed to
// CRAWL the page and read that tag. Some `/share/video/...` URLs are already in
// Google's index; the whole point of this migration is to get them dropped.
//
// If we also `Disallow` them, Google stops fetching them and therefore never sees
// the `noindex` — they freeze in the index forever ("Indexed, though blocked by
// robots.txt"). So we must let Googlebot crawl them until it has de-indexed them.
//
// Do NOT re-add a `Disallow` for `share`/`s` before Google has dropped them — that
// re-introduces exactly the un-removable state this fix exists to avoid. The
// authed segments below are fine to disallow: they were never indexed and mostly
// redirect to login.

export default function robots(): MetadataRoute.Robots {
  const segments = [...AUTHED_SEGMENTS];

  // Bare path + all 6 locale-prefixed variants, cross-producted so
  // `/ja/chat` etc. are blocked too — generated, not hand-written.
  const disallow = segments.flatMap((segment) => [
    `/${segment}`,
    `/${segment}/`,
    ...PREFIXED_LOCALES.map((locale) => `/${locale}/${segment}`),
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
