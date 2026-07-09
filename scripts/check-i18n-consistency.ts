import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { flattenLeaves } from './i18n/merge-locales.core';
import { ROUTE_POLICY } from '../clients/web/lib/i18n/route-policy';

const LANGS = ['zh-CN', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'];
const DIR = 'packages/i18n/src/messages';
const APP_LOCALE_DIR = 'clients/web/app/[locale]';

export function assertAligned(byLang: Record<string, Record<string, unknown>>): string[] {
  const langs = Object.keys(byLang);
  if (langs.length === 0) return [];
  const keySets = Object.fromEntries(
    langs.map((l) => [l, new Set(Object.keys(flattenLeaves(byLang[l])))]),
  );
  const union = new Set<string>();
  langs.forEach((l) => keySets[l].forEach((k) => union.add(k)));
  const issues: string[] = [];
  for (const l of langs) {
    for (const k of union) {
      if (!keySets[l].has(k)) issues.push(`[${l}] missing key: ${k}`);
    }
  }
  return issues;
}

/** 把 `clients/web/app/[locale]/(public)/ai/image/page.tsx` 还原成路由模板 `/ai/image`。 */
export function pageFileToTemplate(file: string): string {
  const rel = file
    .replace(/^clients\/web\/app\/\[locale\]/, '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/\([^)]+\)/g, ''); // 剥离路由组，如 (public)、(marketplace-public)
  return rel === '' ? '/' : rel;
}

function collectPages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) collectPages(p, out);
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

export function assertRoutePolicyCoverage(pages: string[], policyKeys: string[]): string[] {
  const declared = new Set(policyKeys);
  return pages
    .map(pageFileToTemplate)
    .filter((t) => !declared.has(t))
    .map((t) => `[route-policy] 缺少声明: ${t}`);
}

function main() {
  const byLang: Record<string, Record<string, unknown>> = {};
  for (const l of LANGS) {
    byLang[l] = JSON.parse(readFileSync(join(DIR, `${l}.json`), 'utf8'));
  }
  const issues = assertAligned(byLang);

  const pages = collectPages(APP_LOCALE_DIR);
  issues.push(...assertRoutePolicyCoverage(pages, Object.keys(ROUTE_POLICY)));

  if (issues.length) {
    console.error(`i18n 一致性检查失败（${issues.length} 项）:`);
    issues.slice(0, 50).forEach((i) => console.error(`- ${i}`));
    process.exit(1);
  }
  console.log('i18n messages aligned across all languages; route-policy covers all pages.');
}

if (import.meta.main) main();
