import fs from 'fs';
import path from 'path';
import { DOC_LOCALES, DOC_SLUGS } from './docs';

const CONTENT_DIR = path.join(process.cwd(), 'content/docs');

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
  for (const locale of DOC_LOCALES) {
    for (const slug of DOC_SLUGS) {
      params.push({ locale, slug: [slug] });
    }
  }
  return params;
}

export function getStaticDocIndexParams() {
  return DOC_LOCALES.map((locale) => ({ locale }));
}
