import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flattenLeaves } from './i18n/merge-locales.core';

const LANGS = ['zh-CN', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'];
const DIR = 'packages/i18n/src/messages';

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

function main() {
  const byLang: Record<string, Record<string, unknown>> = {};
  for (const l of LANGS) {
    byLang[l] = JSON.parse(readFileSync(join(DIR, `${l}.json`), 'utf8'));
  }
  const issues = assertAligned(byLang);
  if (issues.length) {
    console.error(`i18n key 不一致（${issues.length} 项）:`);
    issues.slice(0, 50).forEach((i) => console.error(`- ${i}`));
    process.exit(1);
  }
  console.log('i18n messages aligned across all languages.');
}

if (import.meta.main) main();
