import type { MetadataRoute } from 'next';
import { routing, PREFIXED_LOCALES } from '@/i18n/routing';
import { resolveSiteUrl } from '@/lib/i18n/site-url';
import { getPolicy, localizedPath, SITEMAP_STATIC_ROUTES, type Policy } from '@/lib/i18n/route-policy';
import { DOC_SLUGS } from '@/lib/docs';

/** Next.js hard-fails a sitemap once it exceeds this many URLs. */
const MAX_ENTRIES = 50_000;

/**
 * Fixed build-time timestamp. `sitemap.ts` is evaluated at build time, so a
 * live `new Date()` would make every rebuild produce a diff-only-in-timestamps
 * sitemap. Bump manually when the static route set materially changes.
 * UGC entries (deferred to a later PR) will carry real per-entry values.
 */
const LAST_MODIFIED = new Date('2026-07-09T00:00:00.000Z');

function absolute(path: string, siteUrl: URL): string {
  return new URL(path, siteUrl).toString();
}

/**
 * Emits the sitemap entries for one route template according to its policy:
 * - full    → bare path + all 6 prefixed locale variants
 * - partial → bare path + only the declared non-default locales
 * - neutral → bare path only
 * - noindex → nothing (proactively omitted, never just relying on callers
 *             not passing noindex routes in)
 */
function emit(
  entries: MetadataRoute.Sitemap,
  path: string,
  policy: Policy,
  siteUrl: URL,
): void {
  if (policy.kind === 'noindex') return;

  entries.push({ url: absolute(path, siteUrl), lastModified: LAST_MODIFIED });

  if (policy.kind === 'full') {
    for (const locale of PREFIXED_LOCALES) {
      entries.push({
        url: absolute(localizedPath(path, locale), siteUrl),
        lastModified: LAST_MODIFIED,
      });
    }
  } else if (policy.kind === 'partial') {
    for (const locale of policy.locales) {
      if (locale === routing.defaultLocale) continue;
      entries.push({
        url: absolute(localizedPath(path, locale), siteUrl),
        lastModified: LAST_MODIFIED,
      });
    }
  }
  // neutral: bare path only, already pushed above.
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  // Read at call time, not import time: `resolveSiteUrl()` re-reads
  // `NEXT_PUBLIC_SITE_URL` on every call rather than freezing it at module
  // load, which matters for tests that set the env var in `beforeAll` (see
  // `lib/i18n/site-url.ts` for why the eager `SITE_URL` export doesn't work
  // here — `build-alternates.ts` hits the same issue).
  const siteUrl = resolveSiteUrl();

  for (const route of SITEMAP_STATIC_ROUTES) {
    emit(entries, route, getPolicy(route), siteUrl);
  }

  // Doc detail pages: slugs are a build-time constant (DOC_SLUGS), so the
  // full path set is enumerable without a runtime query. The policy is
  // declared once against the route template `/docs/[...slug]`.
  const docsPolicy = getPolicy('/docs/[...slug]');
  for (const slug of DOC_SLUGS) {
    emit(entries, `/docs/${slug}`, docsPolicy, siteUrl);
  }

  // Deliberately NOT included: UGC detail routes (marketplace item, community
  // post, preset, user profile) require a runtime query to enumerate and are
  // deferred to a later PR. Their canonical/robots metadata is already
  // correct via generateMetadata; omission here only means we don't
  // proactively submit them — Google still finds them via internal links.

  if (entries.length >= MAX_ENTRIES) {
    throw new Error(
      `sitemap entry count ${entries.length} is approaching Next's ${MAX_ENTRIES} limit; ` +
        `switch to generateSitemaps() sharding instead of silently truncating.`,
    );
  }

  return entries;
}
