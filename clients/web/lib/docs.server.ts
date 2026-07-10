import fs from 'fs';
import path from 'path';
import { DOC_SLUGS } from './docs';
import { getPolicy } from './i18n/route-policy';

const CONTENT_DIR = path.join(process.cwd(), 'content/docs');

/** `/docs` 支持的 locale 唯一来源是 `ROUTE_POLICY`。 */
function docLocales(): string[] {
  const policy = getPolicy('/docs');
  return policy.kind === 'partial' ? policy.locales : [];
}

export function loadDoc(locale: string, slug?: string): string | null {
  const filename = slug ? `${slug}.md` : 'index.md';
  const filepath = path.join(CONTENT_DIR, locale, filename);
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch {
    return null;
  }
}

export function getStaticDocParams() {
  const params: { locale: string; slug: string[] }[] = [];
  for (const locale of docLocales()) {
    for (const slug of DOC_SLUGS) {
      params.push({ locale, slug: [slug] });
    }
  }
  return params;
}

export function getStaticDocIndexParams() {
  return docLocales().map((locale) => ({ locale }));
}
