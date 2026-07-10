import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { flattenLeaves } from './i18n/merge-locales.core';
import { ROUTE_POLICY } from '../clients/web/lib/i18n/route-policy';

const LANGS = ['zh-CN', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'];
const DIR = 'packages/i18n/src/messages';
const APP_LOCALE_DIR = 'clients/web/app/[locale]';

/**
 * `packages/i18n`'s `main` points at `dist/index.js`, and the app loads
 * `dist/messages/*.json` at runtime — never `src/messages/*.json` directly.
 * `dist/` is produced by `bun run --cwd packages/i18n build`, whose `tsc`
 * step does NOT copy the message JSON files; only the script's trailing
 * `cp src/messages/*.json dist/messages/` does. A dev who edits
 * `src/messages/*.json` and forgets to rebuild ships a stale `dist/` with
 * the old keys — the check above (`assertAligned`) is blind to this because
 * it only ever reads `src/`.
 */
const DIST_DIR = 'packages/i18n/dist/messages';

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

/**
 * Compares each language's flattened key set between `src/messages` and the
 * built `dist/messages`, in both directions (missing AND stale/extra), so a
 * forgotten rebuild after either adding or removing keys gets caught.
 */
export function assertDistMatchesSrc(
  srcByLang: Record<string, Record<string, unknown>>,
  distByLang: Record<string, Record<string, unknown>>,
): string[] {
  const issues: string[] = [];
  for (const l of Object.keys(srcByLang)) {
    const srcKeys = new Set(Object.keys(flattenLeaves(srcByLang[l])));
    const distKeys = new Set(Object.keys(flattenLeaves(distByLang[l] ?? {})));
    for (const k of srcKeys) {
      if (!distKeys.has(k)) {
        issues.push(
          `[dist:${l}] stale dist/messages — missing key (run \`bun run --cwd packages/i18n build\`): ${k}`,
        );
      }
    }
    for (const k of distKeys) {
      if (!srcKeys.has(k)) {
        issues.push(`[dist:${l}] stale dist/messages — key removed from src but still present: ${k}`);
      }
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

  // `packages/i18n/dist/` is gitignored: on a fresh clone before the first
  // `bun run --cwd packages/i18n build`, it simply doesn't exist yet. That's
  // not a consistency bug — there's nothing built to compare against — so we
  // skip (with a loud warning) rather than hard-failing, which would break
  // `i18n:check` on every clean checkout / first-run CI job before `build`
  // has ever executed.
  //
  // Once `dist/messages` exists (i.e. a build has happened at least once),
  // we do NOT skip again: every subsequent run enforces that it matches
  // `src/messages`. That's deliberate — the failure this survivor exists to
  // catch is exactly "dist/ already exists from a prior build, and someone
  // edited src/ without rebuilding it," which is indistinguishable from a
  // healthy repo unless we diff the two. A silent skip whenever dist/ is
  // present (e.g. only warning) would restore that blind spot; a hard
  // failure only when genuinely absent avoids punishing a clean checkout.
  if (existsSync(DIST_DIR)) {
    const distByLang: Record<string, Record<string, unknown>> = {};
    for (const l of LANGS) {
      const distFile = join(DIST_DIR, `${l}.json`);
      distByLang[l] = existsSync(distFile) ? JSON.parse(readFileSync(distFile, 'utf8')) : {};
    }
    issues.push(...assertDistMatchesSrc(byLang, distByLang));
  } else {
    console.warn(
      `⚠ ${DIST_DIR} not found — skipping src/dist sync check (run \`bun run --cwd packages/i18n build\` first). Expected on a fresh clone; not expected otherwise.`,
    );
  }

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
